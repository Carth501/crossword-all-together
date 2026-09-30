import type {
  ClueRecord,
  CrosswordCell,
  CrosswordEntry,
  CrosswordPuzzle,
  Direction,
  GenerationResult,
} from "./types";

interface PreparedClue extends ClueRecord {
  id: string;
  answer: string;
}

interface BoardCell {
  letter: string | null;
  across: boolean;
  down: boolean;
}

interface Placement {
  clue: PreparedClue;
  direction: Direction;
  row: number;
  col: number;
}

interface GeneratorOptions {
  size?: number;
  targetEntries?: number;
  nodeLimit?: number;
}

const DEFAULT_SIZE = 9;
const DEFAULT_TARGET = 7;
const DEFAULT_NODE_LIMIT = 12000;

export function normalizeClues(records: ClueRecord[]): PreparedClue[] {
  const answers = new Set<string>();
  const clues: PreparedClue[] = [];

  records.forEach((record, index) => {
    const answer = record.answer.toUpperCase().replace(/[^A-Z]/g, "");
    if (
      answer.length < 3 ||
      answer.length > 9 ||
      !record.clue.trim() ||
      answers.has(answer)
    ) {
      return;
    }

    answers.add(answer);
    clues.push({
      ...record,
      id: `${record.source}:${record.puzzleDate}:${record.clueNumber}:${answer}:${index}`,
      answer,
    });
  });

  return clues;
}

export function generateCrossword(
  records: ClueRecord[],
  seed = Date.now(),
  options: GeneratorOptions = {},
): GenerationResult {
  const size = options.size ?? DEFAULT_SIZE;
  const targetEntries = options.targetEntries ?? DEFAULT_TARGET;
  const nodeLimit = options.nodeLimit ?? DEFAULT_NODE_LIMIT;
  const clues = normalizeClues(records).filter(
    ({ answer }) => answer.length <= size,
  );

  if (size < 3 || targetEntries < 2 || clues.length < targetEntries) {
    return {
      ok: false,
      reason: "Not enough usable clues to build a crossword.",
    };
  }

  const normalizedSeed = seed >>> 0;
  const random = createRandom(normalizedSeed || 0x9e3779b9);
  const candidates = shuffle(clues, random);
  const minimumPerDirection = Math.floor(targetEntries / 2);
  let visited = 0;

  for (const firstClue of candidates) {
    if (visited >= nodeLimit) break;

    const firstPlacement: Placement = {
      clue: firstClue,
      direction: "across",
      row: Math.floor(size / 2),
      col: Math.floor((size - firstClue.answer.length) / 2),
    };
    const board = createBoard(size);
    placeOnBoard(board, firstPlacement);

    const placements = [firstPlacement];
    const used = new Set([firstClue.id]);
    const search = (currentBoard: BoardCell[][]): boolean => {
      if (placements.length === targetEntries) {
        const acrossCount = placements.filter(
          ({ direction }) => direction === "across",
        ).length;
        const downCount = placements.length - acrossCount;
        return (
          acrossCount >= minimumPerDirection && downCount >= minimumPerDirection
        );
      }

      const acrossCount = placements.filter(
        ({ direction }) => direction === "across",
      ).length;
      const downCount = placements.length - acrossCount;
      const firstDirection: Direction =
        acrossCount > downCount ? "down" : "across";
      const directions: Direction[] = [
        firstDirection,
        firstDirection === "down" ? "across" : "down",
      ];

      for (const direction of directions) {
        const remaining = shuffle(
          candidates.filter(({ id }) => !used.has(id)),
          random,
        );
        const possible: Placement[] = [];

        for (const clue of remaining) {
          possible.push(...findPlacements(currentBoard, clue, direction, size));
        }

        for (const placement of possible) {
          visited += 1;
          if (visited > nodeLimit) return false;

          const nextBoard = cloneBoard(currentBoard);
          placeOnBoard(nextBoard, placement);
          placements.push(placement);
          used.add(placement.clue.id);

          if (search(nextBoard)) return true;

          placements.pop();
          used.delete(placement.clue.id);
          if (visited >= nodeLimit) return false;
        }
      }

      return false;
    };

    if (search(board)) {
      return {
        ok: true,
        puzzle: buildPuzzle(size, normalizedSeed, placements),
      };
    }
  }

  return {
    ok: false,
    reason: `Could not fit enough crossing clues into a ${size}×${size} grid.`,
  };
}

function createBoard(size: number): BoardCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      letter: null,
      across: false,
      down: false,
    })),
  );
}

function cloneBoard(board: BoardCell[][]): BoardCell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function findPlacements(
  board: BoardCell[][],
  clue: PreparedClue,
  direction: Direction,
  size: number,
): Placement[] {
  const options: Placement[] = [];
  const seen = new Set<string>();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const existingCell = board[row][col];
      if (existingCell.letter === null) continue;

      for (let index = 0; index < clue.answer.length; index += 1) {
        if (clue.answer[index] !== existingCell.letter) continue;

        const startRow = direction === "down" ? row - index : row;
        const startCol = direction === "across" ? col - index : col;
        const key = `${startRow}:${startCol}:${direction}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const placement = { clue, direction, row: startRow, col: startCol };
        if (canPlace(board, placement, size)) options.push(placement);
      }
    }
  }

  return options;
}

function canPlace(
  board: BoardCell[][],
  placement: Placement,
  size: number,
): boolean {
  const { answer } = placement.clue;
  const { direction, row, col } = placement;
  const rowStep = direction === "down" ? 1 : 0;
  const colStep = direction === "across" ? 1 : 0;
  const beforeRow = row - rowStep;
  const beforeCol = col - colStep;
  const afterRow = row + rowStep * answer.length;
  const afterCol = col + colStep * answer.length;

  if (
    isOccupied(board, beforeRow, beforeCol, size) ||
    isOccupied(board, afterRow, afterCol, size)
  ) {
    return false;
  }

  let crossings = 0;
  for (let index = 0; index < answer.length; index += 1) {
    const currentRow = row + rowStep * index;
    const currentCol = col + colStep * index;
    if (
      currentRow < 0 ||
      currentRow >= size ||
      currentCol < 0 ||
      currentCol >= size
    )
      return false;

    const cell = board[currentRow][currentCol];
    const ownsDirection = direction === "across" ? cell.across : cell.down;
    if (
      ownsDirection ||
      (cell.letter !== null && cell.letter !== answer[index])
    )
      return false;

    if (cell.letter !== null) {
      crossings += 1;
    } else {
      const perpendicularNeighbors =
        direction === "across"
          ? [
              [currentRow - 1, currentCol],
              [currentRow + 1, currentCol],
            ]
          : [
              [currentRow, currentCol - 1],
              [currentRow, currentCol + 1],
            ];
      if (
        perpendicularNeighbors.some(([neighborRow, neighborCol]) =>
          isOccupied(board, neighborRow, neighborCol, size),
        )
      ) {
        return false;
      }
    }
  }

  return crossings > 0;
}

function isOccupied(
  board: BoardCell[][],
  row: number,
  col: number,
  size: number,
): boolean {
  return (
    row >= 0 &&
    row < size &&
    col >= 0 &&
    col < size &&
    board[row][col].letter !== null
  );
}

function placeOnBoard(board: BoardCell[][], placement: Placement): void {
  const rowStep = placement.direction === "down" ? 1 : 0;
  const colStep = placement.direction === "across" ? 1 : 0;
  for (let index = 0; index < placement.clue.answer.length; index += 1) {
    const cell =
      board[placement.row + rowStep * index][placement.col + colStep * index];
    cell.letter = placement.clue.answer[index];
    cell[placement.direction] = true;
  }
}

function buildPuzzle(
  size: number,
  seed: number,
  placements: Placement[],
): CrosswordPuzzle {
  const starts = new Map<string, number>();
  const ordered = [...placements].sort(
    (left, right) => left.row - right.row || left.col - right.col,
  );
  for (const placement of ordered) {
    const key = `${placement.row}:${placement.col}`;
    if (!starts.has(key)) starts.set(key, starts.size + 1);
  }

  const cells: CrosswordCell[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ solution: null as string | null })),
  );
  const entries: CrosswordEntry[] = placements.map((placement) => {
    const id = placement.clue.id;
    const number = starts.get(`${placement.row}:${placement.col}`) ?? 0;
    const rowStep = placement.direction === "down" ? 1 : 0;
    const colStep = placement.direction === "across" ? 1 : 0;

    for (let index = 0; index < placement.clue.answer.length; index += 1) {
      const cell =
        cells[placement.row + rowStep * index][placement.col + colStep * index];
      cell.solution = placement.clue.answer[index];
      if (index === 0) cell.number = number;
      if (placement.direction === "across") cell.acrossEntryId = id;
      else cell.downEntryId = id;
    }

    return {
      ...placement.clue,
      direction: placement.direction,
      number,
      startRow: placement.row,
      startCol: placement.col,
    };
  });

  return { size, seed, cells, entries };
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[other];
    shuffled[other] = current;
  }
  return shuffled;
}
