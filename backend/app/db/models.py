"""SQLAlchemy ORM models for users, the imported clue corpus, and daily puzzles."""
import enum
import uuid
from datetime import date, datetime

from fastapi_users_db_sqlalchemy import SQLAlchemyBaseUserTableUUID
from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Direction(str, enum.Enum):
    ACROSS = "across"
    DOWN = "down"


class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"

    display_name: Mapped[str] = mapped_column(String(64))


class Clue(Base):
    """A single (answer, hint) pair imported from the cryptics.georgeho.org corpus."""

    __tablename__ = "clues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    answer: Mapped[str] = mapped_column(String(32), index=True)
    hint: Mapped[str] = mapped_column(String(512))
    source: Mapped[str | None] = mapped_column(String(128), nullable=True)
    length: Mapped[int] = mapped_column(Integer, index=True)


class Puzzle(Base):
    """One generated crossword, unique per calendar day (UTC)."""

    __tablename__ = "puzzles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    puzzle_date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    grid_size: Mapped[int] = mapped_column(Integer)
    # Row-major list of booleans: True = blocked (black) cell.
    blocked_cells: Mapped[list[list[bool]]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lines: Mapped[list["Line"]] = relationship(back_populates="puzzle", cascade="all, delete-orphan")


class Line(Base):
    """A single across/down word slot within a puzzle."""

    __tablename__ = "lines"
    __table_args__ = (UniqueConstraint("puzzle_id", "number", "direction"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    puzzle_id: Mapped[int] = mapped_column(ForeignKey("puzzles.id"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    direction: Mapped[Direction] = mapped_column(Enum(Direction))
    start_row: Mapped[int] = mapped_column(Integer)
    start_col: Mapped[int] = mapped_column(Integer)
    length: Mapped[int] = mapped_column(Integer)
    answer: Mapped[str] = mapped_column(String(32))
    hint: Mapped[str] = mapped_column(String(512))

    puzzle: Mapped[Puzzle] = relationship(back_populates="lines")

    def cells(self) -> list[tuple[int, int]]:
        """Row/col coordinates of every cell this line occupies, in order."""
        if self.direction == Direction.ACROSS:
            return [(self.start_row, self.start_col + i) for i in range(self.length)]
        return [(self.start_row + i, self.start_col) for i in range(self.length)]


class LineAssignment(Base):
    """Which player owns which line for a given puzzle. Permanent for the day."""

    __tablename__ = "line_assignments"
    __table_args__ = (UniqueConstraint("line_id"), UniqueConstraint("puzzle_id", "user_id"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    puzzle_id: Mapped[int] = mapped_column(ForeignKey("puzzles.id"), index=True)
    line_id: Mapped[int] = mapped_column(ForeignKey("lines.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed: Mapped[bool] = mapped_column(Boolean, default=False)


class CellContribution(Base):
    """A single line-owner's letter at a cell. A shared cell can hold up to two rows here."""

    __tablename__ = "cell_contributions"
    __table_args__ = (UniqueConstraint("line_id", "row", "col"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    puzzle_id: Mapped[int] = mapped_column(ForeignKey("puzzles.id"), index=True)
    line_id: Mapped[int] = mapped_column(ForeignKey("lines.id"), index=True)
    row: Mapped[int] = mapped_column(Integer)
    col: Mapped[int] = mapped_column(Integer)
    letter: Mapped[str] = mapped_column(String(1))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
