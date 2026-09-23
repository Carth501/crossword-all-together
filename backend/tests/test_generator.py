"""Generator tests: no letter conflicts, deterministic given a seed, connected grid."""
from app.puzzles.generator import Direction, generate_puzzle

SAMPLE_CLUES = [
    ("PYTHON", "Programming language"),
    ("TORCH", "ML framework, or a light"),
    ("REACT", "Frontend library"),
    ("NODE", "JS runtime"),
    ("TYPES", "Static checking helps here"),
    ("HINTS", "Clues for players"),
    ("GRIDS", "Crossword layout"),
    ("WORDS", "What fills a grid"),
    ("CROSS", "Intersecting lines"),
    ("PUZZLE", "The whole game"),
    ("LETTER", "Single grid cell content"),
    ("PLAYER", "Solves one line"),
]


def test_generate_puzzle_is_deterministic():
    a = generate_puzzle(SAMPLE_CLUES, target_lines=5, grid_size=15, seed=42)
    b = generate_puzzle(SAMPLE_CLUES, target_lines=5, grid_size=15, seed=42)
    assert a.blocked_cells == b.blocked_cells
    assert [(p.answer, p.direction, p.start_row, p.start_col) for p in a.placements] == [
        (p.answer, p.direction, p.start_row, p.start_col) for p in b.placements
    ]


def test_generate_puzzle_no_letter_conflicts():
    result = generate_puzzle(SAMPLE_CLUES, target_lines=6, grid_size=15, seed=7)
    grid: dict[tuple[int, int], str] = {}
    for placement in result.placements:
        for (r, c), letter in zip(placement.cells(), placement.answer):
            if (r, c) in grid:
                assert grid[(r, c)] == letter
            grid[(r, c)] = letter
    assert len(result.placements) >= 2


def test_generate_puzzle_at_least_one_intersection():
    result = generate_puzzle(SAMPLE_CLUES, target_lines=6, grid_size=15, seed=7)
    across_cells = {
        cell for p in result.placements if p.direction == Direction.ACROSS for cell in p.cells()
    }
    down_cells = {
        cell for p in result.placements if p.direction == Direction.DOWN for cell in p.cells()
    }
    assert across_cells & down_cells
