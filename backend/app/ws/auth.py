"""Extract the authenticated user from a WebSocket handshake's auth cookie."""
from __future__ import annotations

from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.users import UserManager, auth_backend
from app.db.models import User


async def get_user_from_cookie(token: str | None, session: AsyncSession) -> User | None:
    if not token:
        return None
    user_db = SQLAlchemyUserDatabase(session, User)
    user_manager = UserManager(user_db)
    strategy = auth_backend.get_strategy()
    user = await strategy.read_token(token, user_manager)
    if user is None or not user.is_active:
        return None
    return user
