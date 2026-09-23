"""Builds client-facing puzzle payloads. Never includes `Line.answer` except
server-side when validating a submission."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CellContribution, Line, LineAssignment, Puzzle


async def _cell_contributions(session: AsyncSession, puzzle_id: int) -> dict[tuple[int, int], list[dict]]:
    rows = (
        await session.execute(select(CellContribution).where(CellContribution.puzzle_id == puzzle_id))
    ).scalars().all()
    by_cell: dict[tuple[int, int], list[dict]] = {}
    for row in rows:
        by_cell.setdefault((row.row, row.col), []).append({"line_id": row.line_id, "letter": row.letter})
    return by_cell


async def build_state_sync(
    session: AsyncSession, puzzle: Puzzle, viewer_user_id: uuid.UUID | None
) -> dict:
    lines = (await session.execute(select(Line).where(Line.puzzle_id == puzzle.id))).scalars().all()
    assignments = (
        await session.execute(select(LineAssignment).where(LineAssignment.puzzle_id == puzzle.id))
    ).scalars().all()
    assignment_by_line = {a.line_id: a for a in assignments}
    my_line_id = next((a.line_id for a in assignments if a.user_id == viewer_user_id), None)

    contributions = await _cell_contributions(session, puzzle.id)

    return {
        "type": "state_sync",
        "puzzle": {
            "id": puzzle.id,
            "date": puzzle.puzzle_date.isoformat(),
            "size": puzzle.grid_size,
            "blocked_cells": puzzle.blocked_cells,
        },
        "my_line_id": my_line_id,
        "lines": [
            {
                "id": line.id,
                "number": line.number,
                "direction": line.direction.value,
                "start_row": line.start_row,
                "start_col": line.start_col,
                "length": line.length,
                "hint": line.hint,
                "owned": line.id in assignment_by_line,
                "completed": assignment_by_line[line.id].completed if line.id in assignment_by_line else False,
                "is_mine": line.id == my_line_id,
            }
            for line in lines
        ],
        "cells": [
            {"row": r, "col": c, "contributions": contribs}
            for (r, c), contribs in contributions.items()
        ],
    }
