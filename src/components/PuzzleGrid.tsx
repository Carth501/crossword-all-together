import { useMemo } from "react";
import { cellKey, usePuzzleStore } from "@/lib/puzzleStore";
import { lineCells } from "@/lib/gridGeometry";
import { usePuzzleSocket } from "@/hooks/usePuzzleSocket";
import { cn } from "@/lib/utils";

export function PuzzleGrid() {
  const puzzle = usePuzzleStore((s) => s.puzzle);
  const lines = usePuzzleStore((s) => s.lines);
  const myLineId = usePuzzleStore((s) => s.myLineId);
  const cells = usePuzzleStore((s) => s.cells);
  const { submitLetter, submitLine } = usePuzzleSocket();

  const myLine = useMemo(() => lines.find((l) => l.id === myLineId) ?? null, [lines, myLineId]);

  // Map each (row,col) -> the numbered clue that starts there (for corner labels).
  const numberByCell = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) {
      map.set(cellKey(line.start_row, line.start_col), line.number);
    }
    return map;
  }, [lines]);

  const myCellKeys = useMemo(() => {
    if (!myLine) return new Set<string>();
    return new Set(lineCells(myLine).map(([r, c]) => cellKey(r, c)));
  }, [myLine]);

  if (!puzzle) return <p className="text-muted-foreground">Loading puzzle…</p>;

  return (
    <div className="flex flex-col items-center gap-6">
      {myLine && (
        <div className="w-full max-w-md rounded-lg border bg-card p-4 text-left">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {myLine.number} {myLine.direction} · {myLine.length} letters
          </p>
          <p className="mt-1 font-medium">{myLine.hint}</p>
          <button
            className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            disabled={myLine.completed}
            onClick={() => submitLine(myLine.id)}
          >
            {myLine.completed ? "Solved!" : "Submit answer"}
          </button>
        </div>
      )}

      <div
        className="grid gap-px bg-border p-px"
        style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 2rem))` }}
      >
        {puzzle.blocked_cells.map((rowArr, r) =>
          rowArr.map((blocked, c) => {
            const key = cellKey(r, c);
            if (blocked) {
              return <div key={key} className="size-8 bg-foreground/80" />;
            }
            const contributions = cells[key] ?? [];
            const isMine = myCellKeys.has(key);
            const hasConflict =
              contributions.length > 1 &&
              new Set(contributions.map((c) => c.letter)).size > 1;
            const number = numberByCell.get(key);

            return (
              <div
                key={key}
                className={cn(
                  "relative size-8 bg-background text-center",
                  !isMine && "opacity-50"
                )}
              >
                {number && (
                  <span className="pointer-events-none absolute left-0.5 top-0 text-[9px] leading-none text-muted-foreground">
                    {number}
                  </span>
                )}
                {isMine ? (
                  <input
                    maxLength={1}
                    value={contributions.find((c) => c.line_id === myLine!.id)?.letter ?? ""}
                    onChange={(e) => submitLetter(myLine!.id, r, c, e.target.value)}
                    className="size-8 bg-(--cell-owned) text-center uppercase outline-none"
                  />
                ) : hasConflict ? (
                  <span className="flex h-8 items-center justify-center bg-(--cell-conflict) text-[10px] font-semibold uppercase leading-none">
                    {contributions.map((c) => c.letter).join("/")}
                  </span>
                ) : (
                  <span className="flex h-8 items-center justify-center uppercase">
                    {contributions[0]?.letter ?? ""}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
