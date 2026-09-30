import { describe, expect, it } from "vitest";
import { clueRecords } from "../data/clues";
import { generateCrossword, normalizeClues } from "./generate";
import type { ClueRecord, CrosswordPuzzle } from "./types";

function clue(answer: string): ClueRecord {
  return {
    answer,
    clue: `A clue for ${answer}`,
    clueNumber: "1a",
    puzzleDate: "2024-01-01",
    puzzleName: "Test puzzle",
    source: "test",
    sourceUrl: "https://example.com",
  };
}

function hasUncrossedTouch(puzzle: CrosswordPuzzle): boolean {
  return puzzle.cells.some((row, rowIndex) =>
    row.some((cell, colIndex) => {
      if (cell.solution === null) return false;

      const above = puzzle.cells[rowIndex - 1]?.[colIndex];
      const below = puzzle.cells[rowIndex + 1]?.[colIndex];
      const left = row[colIndex - 1];
      const right = row[colIndex + 1];
      const touchesVertical = [above, below].some(
        (neighbor) => neighbor && neighbor.solution !== null,
      );
      const touchesHorizontal = [left, right].some(
        (neighbor) => neighbor && neighbor.solution !== null,
      );

      return (
        (Boolean(cell.acrossEntryId) && touchesVertical && !cell.downEntryId) ||
        (Boolean(cell.downEntryId) && touchesHorizontal && !cell.acrossEntryId)
      );
    }),
  );
}

describe("normalizeClues", () => {
  it("normalizes answers and filters short, long, empty, and duplicate clues", () => {
    const normalized = normalizeClues([
      clue("take-off"),
      clue("TAKE OFF"),
      clue("AB"),
      clue("ABCDEFGHIJ"),
      { ...clue("VALID"), clue: "  " },
    ]);

    expect(normalized.map(({ answer }) => answer)).toEqual(["TAKEOFF"]);
  });
});

describe("generateCrossword", () => {
  it("can build a balanced four-entry crossing layout", () => {
    const result = generateCrossword(
      [clue("ABC"), clue("XQA"), clue("ABZ"), clue("XYZ")],
      11,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.puzzle.entries.filter(({ direction }) => direction === "across"),
    ).toHaveLength(2);
    expect(
      result.puzzle.entries.filter(({ direction }) => direction === "down"),
    ).toHaveLength(2);
    expect(
      result.puzzle.cells.flat().filter(({ solution }) => solution !== null),
    ).toHaveLength(9);
  });

  it("generates a rectangular grid with the requested dimensions", () => {
    const result = generateCrossword(
      [clue("ABC"), clue("XQA"), clue("ABZ"), clue("XYZ")],
      11,
      {
        rows: 5,
        cols: 7,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.rows).toBe(5);
    expect(result.puzzle.cols).toBe(7);
    expect(result.puzzle.cells).toHaveLength(5);
    expect(result.puzzle.cells.every((row) => row.length === 7)).toBe(true);
  });

  it("supports answers longer than nine cells on larger grids", () => {
    const result = generateCrossword([clue("XXXXXAXXXX"), clue("ABC")], 11, {
      rows: 12,
      cols: 12,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.rows).toBe(12);
    expect(result.puzzle.cols).toBe(12);
    expect(
      result.puzzle.entries.some(({ answer }) => answer.length === 10),
    ).toBe(true);
  });

  it("builds a playable puzzle from the bundled clue sample", () => {
    const result = generateCrossword(clueRecords, 2026);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.entries.length).toBeGreaterThan(7);
    expect(
      result.puzzle.entries.filter(({ direction }) => direction === "across")
        .length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      result.puzzle.entries.filter(({ direction }) => direction === "down")
        .length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("generates from the bundled sample across varied seeds", () => {
    const seeds = [1, 7, 17, 42, 99, 2024, 4096, 8192];
    const puzzles = seeds.map((seed) => generateCrossword(clueRecords, seed));
    const successes = puzzles.filter((result) => result.ok);

    expect(successes.length).toBeGreaterThanOrEqual(7);
    for (const result of successes) {
      if (result.ok) expect(hasUncrossedTouch(result.puzzle)).toBe(false);
    }
  });

  it("returns the same crossing grid for the same seed", () => {
    const records = [clue("CATS"), clue("ANTS")];
    const first = generateCrossword(records, 17);
    const second = generateCrossword(records, 17);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      first.puzzle.entries.map(({ direction }) => direction).sort(),
    ).toEqual(["across", "down"]);
    expect(
      first.puzzle.cells.flat().filter(({ solution }) => solution !== null),
    ).toHaveLength(7);
  });

  it("returns the best balanced layout found within the node limit", () => {
    const result = generateCrossword([clue("CATS"), clue("ANTS")], 17, {
      nodeLimit: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.entries).toHaveLength(2);
    expect(
      result.puzzle.entries.some(({ direction }) => direction === "across"),
    ).toBe(true);
    expect(
      result.puzzle.entries.some(({ direction }) => direction === "down"),
    ).toBe(true);
  });

  it("returns a bounded failure for an unusable sample", () => {
    const result = generateCrossword([clue("AB"), clue("ABCDEFGHIJ")], 5);

    expect(result).toEqual({
      ok: false,
      reason: "Not enough usable clues to build a crossword.",
    });
  });

  it("returns a single usable line when no clues can cross", () => {
    const result = generateCrossword([clue("CAT")], 17);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.puzzle.entries).toHaveLength(1);
  });
});
