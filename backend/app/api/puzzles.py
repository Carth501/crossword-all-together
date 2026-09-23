"""REST endpoints for puzzle state (read-only snapshots; live updates go over WS)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.users import current_active_user
from app.db.base import get_async_session
from app.db.models import User
from app.puzzles.serialize import build_state_sync
from app.puzzles.service import assign_line_to_user, get_today_puzzle

router = APIRouter(prefix="/api/puzzle", tags=["puzzle"])


@router.get("/today")
async def puzzle_today(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    puzzle = await get_today_puzzle(session)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="today's puzzle has not been generated yet")
    return await build_state_sync(session, puzzle, user.id)


@router.get("/today/my-line")
async def my_line(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict:
    puzzle = await get_today_puzzle(session)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="today's puzzle has not been generated yet")
    assignment = await assign_line_to_user(session, puzzle, user)
    if assignment is None:
        return {"status": "spectator"}
    state = await build_state_sync(session, puzzle, user.id)
    mine = next(line for line in state["lines"] if line["id"] == assignment.line_id)
    return {"status": "assigned", "line": mine}
