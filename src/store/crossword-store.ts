import { create } from "zustand";
import { generateCrossword } from "../crossword/generate";
import type {
  CrosswordPuzzle,
  Direction,
  GridDimensions,
} from "../crossword/types";
import { clueRecords } from "../data/clues";

export interface CellPosition {
  row: number;
  col: number;
}

type PuzzleStatus = "idle" | "ready" | "solved" | "error";

interface CrosswordState {
  puzzle: CrosswordPuzzle | null;
  filled: Record<string, string>;
  selectedCell: CellPosition | null;
  direction: Direction;
  status: PuzzleStatus;
  error: string | null;
  generate: (seed?: number, dimensions?: GridDimensions) => void;
  selectCell: (position: CellPosition) => void;
  selectEntry: (entryId: string) => void;
  setDirection: (direction: Direction) => void;
  moveSelection: (rowDelta: number, colDelta: number) => void;
  enterLetter: (letter: string) => void;
  backspace: () => void;
  clearAnswers: () => void;
}

function cellKey(position: CellPosition): string {
  return `${position.row}:${position.col}`;
}

function entryAt(
  puzzle: CrosswordPuzzle,
  position: CellPosition,
  direction: Direction,
): string | undefined {
  const cell = puzzle.cells[position.row]?.[position.col];
  return direction === "across" ? cell?.acrossEntryId : cell?.downEntryId;
}

function nextCell(
  puzzle: CrosswordPuzzle,
  position: CellPosition,
  direction: Direction,
  step: number,
): CellPosition | null {
  const rowDelta = direction === "down" ? step : 0;
  const colDelta = direction === "across" ? step : 0;
  let row = position.row + rowDelta;
  let col = position.col + colDelta;

  while (row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols) {
    if (
      puzzle.cells[row][col].solution !== null &&
      entryAt(puzzle, { row, col }, direction)
    ) {
      return { row, col };
    }
    row += rowDelta;
    col += colDelta;
  }

  return null;
}

function puzzleIsSolved(
  puzzle: CrosswordPuzzle,
  filled: Record<string, string>,
): boolean {
  return puzzle.cells.every((row, rowIndex) =>
    row.every(
      (cell, colIndex) =>
        cell.solution === null ||
        filled[cellKey({ row: rowIndex, col: colIndex })] === cell.solution,
    ),
  );
}

export const useCrosswordStore = create<CrosswordState>((set, get) => ({
  puzzle: null,
  filled: {},
  selectedCell: null,
  direction: "across",
  status: "idle",
  error: null,
  generate: (
    seed = Math.floor(Math.random() * 0xffffffff),
    dimensions = { rows: 9, cols: 9 },
  ) => {
    const result = generateCrossword(clueRecords, seed, dimensions);
    if (!result.ok) {
      set({
        puzzle: null,
        filled: {},
        selectedCell: null,
        status: "error",
        error: result.reason,
      });
      return;
    }

    const firstEntry = result.puzzle.entries[0];
    set({
      puzzle: result.puzzle,
      filled: {},
      selectedCell: { row: firstEntry.startRow, col: firstEntry.startCol },
      direction: firstEntry.direction,
      status: "ready",
      error: null,
    });
  },
  selectCell: (position) => {
    const puzzle = get().puzzle;
    const cell = puzzle?.cells[position.row]?.[position.col];
    if (!puzzle || !cell || cell.solution === null) return;

    const { direction, selectedCell } = get();
    const currentHasEntry = Boolean(entryAt(puzzle, position, direction));
    const nextDirection = currentHasEntry
      ? selectedCell?.row === position.row && selectedCell.col === position.col
        ? direction === "across"
          ? "down"
          : "across"
        : direction
      : direction === "across"
        ? "down"
        : "across";
    const resolvedDirection = entryAt(puzzle, position, nextDirection)
      ? nextDirection
      : direction;

    set({ selectedCell: position, direction: resolvedDirection });
  },
  selectEntry: (entryId) => {
    const entry = get().puzzle?.entries.find(({ id }) => id === entryId);
    if (!entry) return;
    set({
      selectedCell: { row: entry.startRow, col: entry.startCol },
      direction: entry.direction,
    });
  },
  setDirection: (direction) => {
    const puzzle = get().puzzle;
    if (!puzzle) return;
    const selectedCell = get().selectedCell;
    if (selectedCell && entryAt(puzzle, selectedCell, direction)) {
      set({ direction });
      return;
    }

    const entry = puzzle.entries.find(
      (candidate) => candidate.direction === direction,
    );
    if (entry)
      set({
        direction,
        selectedCell: { row: entry.startRow, col: entry.startCol },
      });
  },
  moveSelection: (rowDelta, colDelta) => {
    const { puzzle, selectedCell } = get();
    if (!puzzle || !selectedCell) return;

    const direction: Direction = rowDelta === 0 ? "across" : "down";
    const step = rowDelta + colDelta < 0 ? -1 : 1;
    const rowStep = rowDelta === 0 ? 0 : step;
    const colStep = colDelta === 0 ? 0 : step;
    let row = selectedCell.row + rowStep;
    let col = selectedCell.col + colStep;
    while (row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols) {
      if (puzzle.cells[row][col].solution !== null) {
        const resolvedDirection = entryAt(puzzle, { row, col }, direction)
          ? direction
          : get().direction;
        set({ selectedCell: { row, col }, direction: resolvedDirection });
        return;
      }
      row += rowStep;
      col += colStep;
    }
  },
  enterLetter: (letter) => {
    const { puzzle, selectedCell, direction } = get();
    const normalizedLetter = letter.toUpperCase();
    if (!puzzle || !selectedCell || !/^[A-Z]$/.test(normalizedLetter)) return;

    const filled = {
      ...get().filled,
      [cellKey(selectedCell)]: normalizedLetter,
    };
    const next = nextCell(puzzle, selectedCell, direction, 1);
    set({
      filled,
      selectedCell: next ?? selectedCell,
      status: puzzleIsSolved(puzzle, filled) ? "solved" : "ready",
    });
  },
  backspace: () => {
    const { puzzle, selectedCell, direction, filled } = get();
    if (!puzzle || !selectedCell) return;

    const currentKey = cellKey(selectedCell);
    const previous = filled[currentKey]
      ? selectedCell
      : nextCell(puzzle, selectedCell, direction, -1);
    if (!previous) return;

    const nextFilled = { ...filled };
    delete nextFilled[cellKey(previous)];
    set({ filled: nextFilled, selectedCell: previous, status: "ready" });
  },
  clearAnswers: () => {
    const puzzle = get().puzzle;
    set({ filled: {}, status: puzzle ? "ready" : "idle" });
  },
}));
