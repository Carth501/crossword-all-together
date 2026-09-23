import { create } from "zustand";

export type LineDirection = "across" | "down";

export interface LineInfo {
  id: number;
  number: number;
  direction: LineDirection;
  start_row: number;
  start_col: number;
  length: number;
  hint: string;
  owned: boolean;
  completed: boolean;
  is_mine: boolean;
}

export interface CellContribution {
  line_id: number;
  letter: string;
}

interface PuzzleMeta {
  id: number;
  date: string;
  size: number;
  blocked_cells: boolean[][];
}

interface PuzzleState {
  puzzle: PuzzleMeta | null;
  lines: LineInfo[];
  myLineId: number | null;
  isSpectator: boolean;
  /** key: "row,col" -> contributions from each line that passes through it */
  cells: Record<string, CellContribution[]>;

  applyStateSync: (payload: {
    puzzle: PuzzleMeta;
    lines: LineInfo[];
    my_line_id: number | null;
    cells: { row: number; col: number; contributions: CellContribution[] }[];
  }) => void;
  applyCellUpdate: (
    row: number,
    col: number,
    contributions: CellContribution[],
  ) => void;
  setLineCompleted: (lineId: number, completed: boolean) => void;
  setSpectator: (value: boolean) => void;
}

const cellKey = (row: number, col: number) => `${row},${col}`;

export const usePuzzleStore = create<PuzzleState>((set) => ({
  puzzle: null,
  lines: [],
  myLineId: null,
  isSpectator: false,
  cells: {},

  applyStateSync: (payload) =>
    set(() => {
      const cells: Record<string, CellContribution[]> = {};
      for (const cell of payload.cells) {
        cells[cellKey(cell.row, cell.col)] = cell.contributions;
      }
      return {
        puzzle: payload.puzzle,
        lines: payload.lines,
        myLineId: payload.my_line_id,
        cells,
      };
    }),

  applyCellUpdate: (row, col, contributions) =>
    set((state) => ({
      cells: { ...state.cells, [cellKey(row, col)]: contributions },
    })),

  setLineCompleted: (lineId, completed) =>
    set((state) => ({
      lines: state.lines.map((line) =>
        line.id === lineId ? { ...line, completed } : line,
      ),
    })),

  setSpectator: (value) => set({ isSpectator: value }),
}));

export { cellKey };
