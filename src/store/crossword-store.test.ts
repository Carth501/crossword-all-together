import { describe, expect, it } from "vitest";
import { useCrosswordStore } from "./crossword-store";

describe("crossword store", () => {
  it("connects generated entries to letter entry and backspace", () => {
    const store = useCrosswordStore.getState();
    store.generate(42);

    const puzzle = useCrosswordStore.getState().puzzle;
    expect(puzzle).not.toBeNull();
    if (!puzzle) return;

    const entry = puzzle.entries[0];
    useCrosswordStore.getState().selectEntry(entry.id);
    useCrosswordStore.getState().enterLetter("q");

    const firstCellKey = `${entry.startRow}:${entry.startCol}`;
    expect(useCrosswordStore.getState().filled[firstCellKey]).toBe("Q");

    useCrosswordStore.getState().backspace();
    expect(useCrosswordStore.getState().filled[firstCellKey]).toBeUndefined();
    expect(useCrosswordStore.getState().status).toBe("ready");
  });
});
