import type { LineDirection, LineInfo } from "@/lib/puzzleStore";

export function lineCells(line: Pick<LineInfo, "direction" | "start_row" | "start_col" | "length">) {
  const cells: [number, number][] = [];
  for (let i = 0; i < line.length; i++) {
    if (line.direction === ("across" as LineDirection)) {
      cells.push([line.start_row, line.start_col + i]);
    } else {
      cells.push([line.start_row + i, line.start_col]);
    }
  }
  return cells;
}
