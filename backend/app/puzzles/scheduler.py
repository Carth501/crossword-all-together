"""APScheduler job that generates the day's puzzle at 00:00 UTC."""
from __future__ import annotations

from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.base import async_session_maker
from app.puzzles.service import generate_and_store_puzzle

scheduler = AsyncIOScheduler(timezone="UTC")


async def _generate_todays_puzzle() -> None:
    async with async_session_maker() as session:
        await generate_and_store_puzzle(session, datetime.now(timezone.utc).date())


def start_scheduler() -> None:
    scheduler.add_job(_generate_todays_puzzle, CronTrigger(hour=0, minute=0, timezone="UTC"), id="daily_puzzle")
    scheduler.start()
