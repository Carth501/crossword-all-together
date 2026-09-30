export type Direction = "across" | "down";

export interface ClueRecord {
  answer: string;
  clue: string;
  clueNumber: string;
  puzzleDate: string;
  puzzleName: string;
  source: string;
  sourceUrl: string;
}

export interface CrosswordEntry extends ClueRecord {
  id: string;
  direction: Direction;
  number: number;
  startRow: number;
  startCol: number;
}

export interface CrosswordCell {
  solution: string | null;
  number?: number;
  acrossEntryId?: string;
  downEntryId?: string;
}

export interface GridDimensions {
  rows: number;
  cols: number;
}

export interface CrosswordPuzzle extends GridDimensions {
  seed: number;
  cells: CrosswordCell[][];
  entries: CrosswordEntry[];
}

export type GenerationResult =
  | { ok: true; puzzle: CrosswordPuzzle }
  | { ok: false; reason: string };
