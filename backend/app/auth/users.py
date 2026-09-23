"""fastapi-users wiring: user manager, JWT auth backend, and schemas."""
import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, schemas
from fastapi_users.authentication import AuthenticationBackend, CookieTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.base import get_async_session
from app.db.models import User


class UserRead(schemas.BaseUser[uuid.UUID]):
    display_name: str


class UserCreate(schemas.BaseUserCreate):
    display_name: str


class UserUpdate(schemas.BaseUserUpdate):
    display_name: str | None = None


async def get_user_db(session: AsyncSession = Depends(get_async_session)) -> AsyncGenerator:
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.jwt_secret
    verification_token_secret = settings.jwt_secret

    async def on_after_register(self, user: User, request: Request | None = None) -> None:
        pass


async def get_user_manager(user_db=Depends(get_user_db)) -> AsyncGenerator:
    yield UserManager(user_db)


bearer_transport = CookieTransport(cookie_name="crossword_auth", cookie_max_age=settings.jwt_lifetime_seconds, cookie_httponly=True, cookie_samesite="lax")


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.jwt_secret, lifetime_seconds=settings.jwt_lifetime_seconds)


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
