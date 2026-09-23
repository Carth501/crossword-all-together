"""Puzzle lifecycle: generate from the corpus, persist, and assign lines to players."""
from __future__ import annotations

import random
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Clue, Line, LineAssignment, Puzzle, User
from app.puzzles.generator import assign_clue_numbers, generate_puzzle


async def get_puzzle_for_date(session: AsyncSession, puzzle_date: date) -> Puzzle | None:
    result = await session.execute(select(Puzzle).where(Puzzle.puzzle_date == puzzle_date))
    return result.scalar_one_or_none()


async def get_today_puzzle(session: AsyncSession) -> Puzzle | None:
    return await get_puzzle_for_date(session, datetime.now(timezone.utc).date())


async def generate_and_store_puzzle(session: AsyncSession, puzzle_date: date) -> Puzzle:
    existing = await get_puzzle_for_date(session, puzzle_date)
    if existing is not None:
        return existing

    clue_rows = (await session.execute(select(Clue.answer, Clue.hint))).all()
    clues = [(row.answer, row.hint) for row in clue_rows]

    seed = int(puzzle_date.strftime("%Y%m%d"))
    generated = generate_puzzle(
        clues,
        target_lines=settings.player_cap,
        grid_size=settings.grid_size,
        seed=seed,
    )
    numbers = assign_clue_numbers(generated.placements)

    puzzle = Puzzle(
        puzzle_date=puzzle_date,
        grid_size=generated.size,
        blocked_cells=generated.blocked_cells,
    )
    session.add(puzzle)
    await session.flush()  # assign puzzle.id

    for placement in generated.placements:
        line = Line(
            puzzle_id=puzzle.id,
            number=numbers[(placement.start_row, placement.start_col)],
            direction=placement.direction,
            start_row=placement.start_row,
            start_col=placement.start_col,
            length=placement.length,
            answer=placement.answer,
            hint=placement.hint,
        )
        session.add(line)

    await session.commit()
    await session.refresh(puzzle)
    return puzzle


async def assign_line_to_user(session: AsyncSession, puzzle: Puzzle, user: User) -> LineAssignment | None:
    """Give the user their (permanent, for the day) line, or their existing one if already assigned."""
    existing = await session.execute(
        select(LineAssignment).where(
            LineAssignment.puzzle_id == puzzle.id,
            LineAssignment.user_id == user.id,
        )
    )
    assignment = existing.scalar_one_or_none()
    if assignment is not None:
        return assignment

    assigned_line_ids = (
        await session.execute(select(LineAssignment.line_id).where(LineAssignment.puzzle_id == puzzle.id))
    ).scalars().all()

    all_line_ids = (
        await session.execute(select(Line.id).where(Line.puzzle_id == puzzle.id))
    ).scalars().all()

    free_ids = [lid for lid in all_line_ids if lid not in set(assigned_line_ids)]
    if not free_ids:
        return None  # cap reached: caller should treat this player as a spectator

    chosen = random.choice(free_ids)
    assignment = LineAssignment(puzzle_id=puzzle.id, line_id=chosen, user_id=user.id)
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)
    return assignment
