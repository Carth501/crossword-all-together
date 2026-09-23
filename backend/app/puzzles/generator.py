"""Crossword grid generator.

Greedy + backtracking placement: starts from a random seed word and repeatedly
tries to intersect further words from the corpus onto the existing grid until
the target number of lines (== player cap) is placed, or the attempt budget
is exhausted. Deterministic given a seed, so tests can assert on structure.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from app.db.models import Direction


@dataclass
class Placement:
    answer: str
    hint: str
    direction: Direction
    start_row: int
    start_col: int

    @property
    def length(self) -> int:
        return len(self.answer)

    def cells(self) -> list[tuple[int, int]]:
        if self.direction == Direction.ACROSS:
            return [(self.start_row, self.start_col + i) for i in range(self.length)]
        return [(self.start_row + i, self.start_col) for i in range(self.length)]


@dataclass
class GeneratedPuzzle:
    size: int
    blocked_cells: list[list[bool]]
    placements: list[Placement] = field(default_factory=list)


class _WordBank:
    """A shuffled, deduped pool of (answer, hint) candidates grouped by first letter search."""

    def __init__(self, clues: list[tuple[str, str]], rng: random.Random) -> None:
        seen: set[str] = set()
        pool: list[tuple[str, str]] = []
        for answer, hint in clues:
            norm = answer.strip().upper()
            if not norm.isalpha() or norm in seen:
                continue
            if not (3 <= len(norm) <= 12):
                continue
            seen.add(norm)
            pool.append((norm, hint))
        rng.shuffle(pool)
        self._pool = pool

    def __iter__(self):
        return iter(self._pool)


def _fits_without_collision(
    grid: dict[tuple[int, int], str],
    occupied_words: set[tuple[int, int]],
    placement: Placement,
    min_row: int,
    max_row: int,
    min_col: int,
    max_col: int,
) -> bool:
    cells = placement.cells()

    # Cell immediately before/after the word must be free (no accidental run-ons).
    if placement.direction == Direction.ACROSS:
        before = (placement.start_row, placement.start_col - 1)
        after = (placement.start_row, placement.start_col + placement.length)
    else:
        before = (placement.start_row - 1, placement.start_col)
        after = (placement.start_row + placement.length, placement.start_col)
    if before in grid or after in grid:
        return False

    has_intersection = False
    for i, (r, c) in enumerate(cells):
        letter = placement.answer[i]
        existing = grid.get((r, c))
        if existing is not None:
            if existing != letter:
                return False
            has_intersection = True
            continue
        # Empty cell: neighbors perpendicular to the word direction must also be
        # empty, otherwise this letter would silently touch an unrelated word.
        if placement.direction == Direction.ACROSS:
            neighbors = [(r - 1, c), (r + 1, c)]
        else:
            neighbors = [(r, c - 1), (r, c + 1)]
        for n in neighbors:
            if n in grid:
                return False

    return has_intersection


def generate_puzzle(
    clues: list[tuple[str, str]],
    target_lines: int,
    grid_size: int = 15,
    seed: int | None = None,
    max_attempts: int = 4000,
) -> GeneratedPuzzle:
    """Generate a connected crossword grid with up to `target_lines` words.

    Raises ValueError if fewer than 2 words could be placed (corpus too small/sparse).
    """
    rng = random.Random(seed)
    bank = _WordBank(clues, rng)
    words = list(bank)
    if not words:
        raise ValueError("no usable words in corpus")

    grid: dict[tuple[int, int], str] = {}
    placements: list[Placement] = []

    first_answer, first_hint = words[0]
    first = Placement(first_answer, first_hint, Direction.ACROSS, 0, 0)
    for i, ch in enumerate(first_answer):
        grid[(0, i)] = ch
    placements.append(first)

    min_row = max_row = 0
    min_col, max_col = 0, len(first_answer) - 1

    attempts = 0
    word_idx = 1
    while len(placements) < target_lines and attempts < max_attempts and word_idx < len(words):
        answer, hint = words[word_idx]
        word_idx += 1
        attempts += 1

        placed = False
        for i, letter in enumerate(answer):
            # Find existing grid cells with a matching letter to cross through.
            candidates = [pos for pos, ch in grid.items() if ch == letter]
            rng.shuffle(candidates)
            for r, c in candidates:
                for direction in (Direction.ACROSS, Direction.DOWN):
                    if direction == Direction.ACROSS:
                        start_row, start_col = r, c - i
                    else:
                        start_row, start_col = r - i, c
                    candidate = Placement(answer, hint, direction, start_row, start_col)
                    if _fits_without_collision(grid, set(), candidate, min_row, max_row, min_col, max_col):
                        for j, (cr, cc) in enumerate(candidate.cells()):
                            grid[(cr, cc)] = answer[j]
                        placements.append(candidate)
                        min_row = min(min_row, min(p[0] for p in candidate.cells()))
                        max_row = max(max_row, max(p[0] for p in candidate.cells()))
                        min_col = min(min_col, min(p[1] for p in candidate.cells()))
                        max_col = max(max_col, max(p[1] for p in candidate.cells()))
                        placed = True
                        break
                if placed:
                    break
            if placed:
                break

    if len(placements) < 2:
        raise ValueError("could not place enough intersecting words from corpus")

    height = max_row - min_row + 1
    width = max_col - min_col + 1
    size = max(grid_size, height, width)
    row_offset = (size - height) // 2 - min_row
    col_offset = (size - width) // 2 - min_col

    normalized: list[Placement] = [
        Placement(p.answer, p.hint, p.direction, p.start_row + row_offset, p.start_col + col_offset)
        for p in placements
    ]

    blocked = [[True] * size for _ in range(size)]
    for p in normalized:
        for r, c in p.cells():
            blocked[r][c] = False

    return GeneratedPuzzle(size=size, blocked_cells=blocked, placements=normalized)


def assign_clue_numbers(placements: list[Placement]) -> dict[tuple[int, int], int]:
    """Standard crossword numbering: number cells that start an across or down word,
    scanning row-major, sharing one number when a cell starts both."""
    starts = sorted({(p.start_row, p.start_col) for p in placements})
    return {pos: idx + 1 for idx, pos in enumerate(starts)}
