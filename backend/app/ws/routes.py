"""WebSocket endpoint: one room per daily puzzle, live cell/line updates."""
from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_async_session
from app.db.models import CellContribution, Line, LineAssignment
from app.puzzles.serialize import build_state_sync
from app.puzzles.service import assign_line_to_user, get_today_puzzle
from app.ws.auth import get_user_from_cookie
from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws/puzzle")
async def puzzle_ws(websocket: WebSocket, session: AsyncSession = Depends(get_async_session)) -> None:
    await websocket.accept()

    token = websocket.cookies.get("crossword_auth")
    user = await get_user_from_cookie(token, session)
    if user is None:
        await websocket.send_json({"type": "error", "detail": "unauthenticated"})
        await websocket.close(code=4401)
        return

    puzzle = await get_today_puzzle(session)
    if puzzle is None:
        await websocket.send_json({"type": "error", "detail": "no puzzle available yet"})
        await websocket.close(code=4404)
        return

    assignment = await assign_line_to_user(session, puzzle, user)
    if assignment is not None:
        manager.connect_player(puzzle.id, user.id, websocket)
    else:
        manager.connect_spectator(puzzle.id, websocket)
        await websocket.send_json({"type": "room_full"})

    await websocket.send_json(await build_state_sync(session, puzzle, user.id))

    try:
        while True:
            message = await websocket.receive_json()
            await _handle_message(session, puzzle.id, user.id, message, websocket)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(puzzle.id, websocket)


async def _handle_message(
    session: AsyncSession, puzzle_id: int, user_id, message: dict, websocket: WebSocket
) -> None:
    msg_type = message.get("type")

    if msg_type == "request_state":
        from app.db.models import Puzzle  # local import to avoid cycle at module load

        puzzle = await session.get(Puzzle, puzzle_id)
        await websocket.send_json(await build_state_sync(session, puzzle, user_id))
        return

    if msg_type == "submit_letter":
        await _submit_letter(session, puzzle_id, user_id, message, websocket)
        return

    if msg_type == "submit_line":
        await _submit_line(session, puzzle_id, user_id, message, websocket)
        return

    await websocket.send_json({"type": "error", "detail": f"unknown message type {msg_type!r}"})


async def _owned_line(session: AsyncSession, puzzle_id: int, user_id, line_id: int) -> Line | None:
    assignment = (
        await session.execute(
            select(LineAssignment).where(
                LineAssignment.puzzle_id == puzzle_id,
                LineAssignment.user_id == user_id,
                LineAssignment.line_id == line_id,
            )
        )
    ).scalar_one_or_none()
    if assignment is None:
        return None
    return await session.get(Line, line_id)


async def _submit_letter(
    session: AsyncSession, puzzle_id: int, user_id, message: dict, websocket: WebSocket
) -> None:
    line_id = message.get("line_id")
    row, col, letter = message.get("row"), message.get("col"), message.get("letter", "")
    line = await _owned_line(session, puzzle_id, user_id, line_id)
    if line is None:
        await websocket.send_json({"type": "error", "detail": "not your line"})
        return
    if (row, col) not in line.cells():
        await websocket.send_json({"type": "error", "detail": "cell not on your line"})
        return
    letter = (letter or "")[:1].upper()

    existing = (
        await session.execute(
            select(CellContribution).where(
                CellContribution.line_id == line_id,
                CellContribution.row == row,
                CellContribution.col == col,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        existing = CellContribution(puzzle_id=puzzle_id, line_id=line_id, row=row, col=col, letter=letter)
        session.add(existing)
    else:
        existing.letter = letter

    # Editing a letter after submission means the answer is being revised, so reopen it.
    assignment = (
        await session.execute(select(LineAssignment).where(LineAssignment.line_id == line_id))
    ).scalar_one_or_none()
    reopened = assignment is not None and assignment.completed
    if reopened:
        assignment.completed = False
    await session.commit()

    contributions = (
        await session.execute(
            select(CellContribution).where(
                CellContribution.puzzle_id == puzzle_id,
                CellContribution.row == row,
                CellContribution.col == col,
            )
        )
    ).scalars().all()
    await manager.broadcast(
        puzzle_id,
        {
            "type": "cell_update",
            "row": row,
            "col": col,
            "contributions": [{"line_id": c.line_id, "letter": c.letter} for c in contributions],
        },
    )
    if reopened:
        await manager.broadcast(puzzle_id, {"type": "line_status", "line_id": line_id, "completed": False})


async def _submit_line(
    session: AsyncSession, puzzle_id: int, user_id, message: dict, websocket: WebSocket
) -> None:
    line_id = message.get("line_id")
    line = await _owned_line(session, puzzle_id, user_id, line_id)
    if line is None:
        await websocket.send_json({"type": "error", "detail": "not your line"})
        return

    # Submission just marks the line as attempted/done for the day — correctness is
    # never checked or reported back, matching the "no right/wrong indicators" design.
    assignment = (
        await session.execute(
            select(LineAssignment).where(
                LineAssignment.puzzle_id == puzzle_id,
                LineAssignment.line_id == line_id,
            )
        )
    ).scalar_one_or_none()
    if assignment is not None:
        assignment.completed = True
        await session.commit()

    await manager.broadcast(puzzle_id, {"type": "line_status", "line_id": line_id, "completed": True})

