import type {
  ClueRecord,
  CrosswordCell,
  CrosswordEntry,
  CrosswordPuzzle,
  Direction,
  GenerationResult,
  GridDimensions,
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

interface GeneratorOptions extends Partial<GridDimensions> {
  size?: number;
  nodeLimit?: number;
}

const DEFAULT_SIZE = 9;
const DEFAULT_NODE_LIMIT = 12000;

export function normalizeClues(
  records: ClueRecord[],
  maxAnswerLength = DEFAULT_SIZE,
): PreparedClue[] {
  const answers = new Set<string>();
  const clues: PreparedClue[] = [];

  records.forEach((record, index) => {
    const answer = record.answer.toUpperCase().replace(/[^A-Z]/g, "");
    if (
      answer.length < 3 ||
      answer.length > maxAnswerLength ||
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
  const rows = options.rows ?? options.size ?? DEFAULT_SIZE;
  const cols = options.cols ?? options.size ?? DEFAULT_SIZE;
  const nodeLimit = options.nodeLimit ?? DEFAULT_NODE_LIMIT;
  const clues = normalizeClues(records, Math.max(rows, cols)).filter(
    ({ answer }) => answer.length <= Math.max(rows, cols),
  );

  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows < 3 ||
    cols < 3 ||
    clues.length === 0
  ) {
    return {
      ok: false,
      reason: "Not enough usable clues to build a crossword.",
    };
  }

  const normalizedSeed = seed >>> 0;
  const random = createRandom(normalizedSeed || 0x9e3779b9);
  const candidates = shuffle(clues, random);
  let visited = 0;
  let searchLimit = Math.min(
    nodeLimit,
    Math.max(1, Math.floor(nodeLimit / 64)),
  );
  let bestPlacements: Placement[] | null = null;
  let bestCellCount = 0;

  for (const firstClue of candidates) {
    if (visited >= searchLimit) break;
    const firstDirection: Direction =
      firstClue.answer.length <= cols ? "across" : "down";
    if (firstDirection === "down" && firstClue.answer.length > rows) continue;

    const firstPlacement: Placement = {
      clue: firstClue,
      direction: firstDirection,
      row:
        firstDirection === "down"
          ? Math.floor((rows - firstClue.answer.length) / 2)
          : Math.floor(rows / 2),
      col:
        firstDirection === "across"
          ? Math.floor((cols - firstClue.answer.length) / 2)
          : Math.floor(cols / 2),
    };
    const board = createBoard(rows, cols);
    placeOnBoard(board, firstPlacement);

    const placements = [firstPlacement];
    const used = new Set([firstClue.id]);
    const search = (
      currentBoard: BoardCell[][],
      currentCellCount: number,
    ): void => {
      const acrossCount = placements.filter(
        ({ direction }) => direction === "across",
      ).length;
      const downCount = placements.length - acrossCount;
      if (placements.length > 0) {
        if (
          bestPlacements === null ||
          placements.length > bestPlacements.length ||
          (placements.length === bestPlacements.length &&
            currentCellCount > bestCellCount)
        ) {
          const improvedEntryCount =
            bestPlacements === null ||
            placements.length > bestPlacements.length;
          bestPlacements = [...placements];
          bestCellCount = currentCellCount;
          if (improvedEntryCount) {
            searchLimit = Math.min(
              nodeLimit,
              visited + Math.max(1, Math.floor(nodeLimit / 64)),
            );
          }
        }
      }

      if (placements.length >= clues.length || visited >= searchLimit) return;

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
          possible.push(
            ...findPlacements(currentBoard, clue, direction, rows, cols),
          );
        }

        for (const placement of possible) {
          if (visited >= searchLimit) return;
          visited += 1;

          const nextBoard = cloneBoard(currentBoard);
          let addedCellCount = 0;
          const rowStep = placement.direction === "down" ? 1 : 0;
          const colStep = placement.direction === "across" ? 1 : 0;
          for (
            let index = 0;
            index < placement.clue.answer.length;
            index += 1
          ) {
            if (
              currentBoard[placement.row + rowStep * index][
                placement.col + colStep * index
              ].letter === null
            ) {
              addedCellCount += 1;
            }
          }
          placeOnBoard(nextBoard, placement);
          placements.push(placement);
          used.add(placement.clue.id);

          search(nextBoard, currentCellCount + addedCellCount);

          placements.pop();
          used.delete(placement.clue.id);
          if (visited >= searchLimit) return;
        }
      }
    };

    search(board, firstClue.answer.length);
  }

  if (bestPlacements === null) {
    const firstClue = candidates.find(
      ({ answer }) => answer.length <= cols || answer.length <= rows,
    );
    if (firstClue) {
      const direction: Direction =
        firstClue.answer.length <= cols ? "across" : "down";
      bestPlacements = [
        {
          clue: firstClue,
          direction,
          row:
            direction === "down"
              ? Math.floor((rows - firstClue.answer.length) / 2)
              : Math.floor(rows / 2),
          col:
            direction === "across"
              ? Math.floor((cols - firstClue.answer.length) / 2)
              : Math.floor(cols / 2),
        },
      ];
    }
  }

  if (bestPlacements !== null) {
    return {
      ok: true,
      puzzle: buildPuzzle(rows, cols, normalizedSeed, bestPlacements),
    };
  }

  return {
    ok: false,
    reason: `No usable clues fit in a ${rows}×${cols} grid.`,
  };
}

function createBoard(rows: number, cols: number): BoardCell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
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
  rows: number,
  cols: number,
): Placement[] {
  const options: Placement[] = [];
  const seen = new Set<string>();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
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
        if (canPlace(board, placement, rows, cols)) options.push(placement);
      }
    }
  }

  return options;
}

function canPlace(
  board: BoardCell[][],
  placement: Placement,
  rows: number,
  cols: number,
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
    isOccupied(board, beforeRow, beforeCol, rows, cols) ||
    isOccupied(board, afterRow, afterCol, rows, cols)
  ) {
    return false;
  }

  let crossings = 0;
  for (let index = 0; index < answer.length; index += 1) {
    const currentRow = row + rowStep * index;
    const currentCol = col + colStep * index;
    if (
      currentRow < 0 ||
      currentRow >= rows ||
      currentCol < 0 ||
      currentCol >= cols
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
          isOccupied(board, neighborRow, neighborCol, rows, cols),
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
  rows: number,
  cols: number,
): boolean {
  return (
    row >= 0 &&
    row < rows &&
    col >= 0 &&
    col < cols &&
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
  rows: number,
  cols: number,
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

  const cells: CrosswordCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ solution: null as string | null })),
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

  return { rows, cols, seed, cells, entries };
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
