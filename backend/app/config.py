"""Application configuration, loaded from environment variables / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/crossword"
    jwt_secret: str = "change-me-in-production"
    jwt_lifetime_seconds: int = 60 * 60 * 24 * 7

    cors_origins: list[str] = ["http://localhost:5173"]

    # Puzzle rules
    player_cap: int = 12
    grid_size: int = 15

    corpus_db_path: str = "data/cryptics.db"


settings = Settings()
