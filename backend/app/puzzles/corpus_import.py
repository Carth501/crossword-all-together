"""One-off/periodic import of the cryptics.georgeho.org clue corpus (ODbL licensed)
into our own `clues` table. Run as a script: `python -m app.puzzles.corpus_import`.
"""
from __future__ import annotations

import asyncio
import csv
import io

import httpx
from sqlalchemy import select

from app.db.base import async_session_maker
from app.db.models import Clue

CSV_URL = "https://cryptics.georgeho.org/data/clues.csv?_stream=on&_size=max"


def _clean_answer(raw: str) -> str | None:
    """Keep only single-word, alphabetic answers (matches our grid model)."""
    candidate = raw.strip().upper()
    if not candidate.isalpha():
        return None
    if not (3 <= len(candidate) <= 12):
        return None
    return candidate


async def fetch_rows() -> list[tuple[str, str, str]]:
    """Download the CSV export and return (answer, hint, source) tuples."""
    rows: list[tuple[str, str, str]] = []
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("GET", CSV_URL) as response:
            response.raise_for_status()
            text = await response.aread()
    reader = csv.DictReader(io.StringIO(text.decode("utf-8")))
    for row in reader:
        answer = _clean_answer(row.get("answer", ""))
        if answer is None:
            continue
        hint = (row.get("clue") or row.get("definition") or "").strip()
        if not hint:
            continue
        rows.append((answer, hint, row.get("source", "")))
    return rows


async def import_corpus(limit: int | None = None) -> int:
    rows = await fetch_rows()
    if limit is not None:
        rows = rows[:limit]

    inserted = 0
    async with async_session_maker() as session:
        existing = set((await session.scalars(select(Clue.answer))).all())
        for answer, hint, source in rows:
            if answer in existing:
                continue
            existing.add(answer)
            session.add(Clue(answer=answer, hint=hint, source=source, length=len(answer)))
            inserted += 1
            if inserted % 500 == 0:
                await session.commit()
        await session.commit()
    return inserted


if __name__ == "__main__":
    count = asyncio.run(import_corpus())
    print(f"Imported {count} new clues")
