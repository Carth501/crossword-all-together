import { useEffect } from "react";
import "./crossword/crossword.css";
import { useCrosswordStore } from "./store/crossword-store";

function App() {
  const puzzle = useCrosswordStore((state) => state.puzzle);
  const filled = useCrosswordStore((state) => state.filled);
  const selectedCell = useCrosswordStore((state) => state.selectedCell);
  const direction = useCrosswordStore((state) => state.direction);
  const status = useCrosswordStore((state) => state.status);
  const error = useCrosswordStore((state) => state.error);
  const generate = useCrosswordStore((state) => state.generate);
  const selectCell = useCrosswordStore((state) => state.selectCell);
  const selectEntry = useCrosswordStore((state) => state.selectEntry);
  const setDirection = useCrosswordStore((state) => state.setDirection);
  const moveSelection = useCrosswordStore((state) => state.moveSelection);
  const enterLetter = useCrosswordStore((state) => state.enterLetter);
  const backspace = useCrosswordStore((state) => state.backspace);
  const clearAnswers = useCrosswordStore((state) => state.clearAnswers);

  useEffect(() => {
    if (status === "idle") generate(20260930);
  }, [generate, status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isEditable =
        target?.isContentEditable || target?.closest("input, textarea, select");
      const isPuzzleControl = target?.closest(".grid-cell, .clue-button");
      const isOtherControl = target?.closest("button, a") && !isPuzzleControl;
      if (!puzzle || isEditable || isOtherControl) return;

      const movements: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const movement = movements[event.key];
      if (movement) {
        event.preventDefault();
        moveSelection(...movement);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (
        event.key === " " &&
        selectedCell &&
        !target?.closest("button, a")
      ) {
        event.preventDefault();
        selectCell(selectedCell);
      } else if (/^[a-z]$/i.test(event.key)) {
        enterLetter(event.key);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [backspace, enterLetter, moveSelection, puzzle, selectCell, selectedCell]);

  const selectedGridCell =
    selectedCell && puzzle
      ? puzzle.cells[selectedCell.row][selectedCell.col]
      : null;
  const selectedEntryId = selectedGridCell
    ? direction === "across"
      ? selectedGridCell.acrossEntryId
      : selectedGridCell.downEntryId
    : undefined;
  const selectedEntry = puzzle?.entries.find(
    ({ id }) => id === selectedEntryId,
  );
  const totalCells =
    puzzle?.cells.flat().filter(({ solution }) => solution !== null).length ??
    0;
  const enteredCells = Object.keys(filled).length;
  const progress =
    totalCells === 0 ? 0 : Math.round((enteredCells / totalCells) * 100);
  const acrossEntries =
    puzzle?.entries.filter(
      ({ direction: entryDirection }) => entryDirection === "across",
    ) ?? [];
  const downEntries =
    puzzle?.entries.filter(
      ({ direction: entryDirection }) => entryDirection === "down",
    ) ?? [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Crossword home">
          <span className="brand-mark">X</span>
          <span>WORDPLAY</span>
        </a>
        <div className="topbar-note">
          <span className="live-dot" /> CRYPTIC CLUE ARCHIVE
        </div>
        <button
          className="button button--quiet topbar-action"
          type="button"
          onClick={() => generate()}
        >
          New puzzle <span aria-hidden="true">+</span>
        </button>
      </header>

      <main id="top" className="main-content">
        <section className="page-heading">
          <p className="eyebrow">DAILY CONSTRUCTION / 09 x 09</p>
          <h1>
            Crossword <span>No. 01</span>
          </h1>
        </section>

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}

        {puzzle ? (
          <div className="play-layout">
            <section className="board-section" aria-label="Crossword grid">
              <div className="board-topline">
                <span>PUZZLE 001</span>
                <span>
                  {enteredCells} / {totalCells} LETTERS
                </span>
              </div>
              <div
                className="crossword-grid"
                role="grid"
                aria-label={`${puzzle.size} by ${puzzle.size} crossword`}
                style={{
                  gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`,
                }}
              >
                {puzzle.cells.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    if (cell.solution === null) {
                      return (
                        <div
                          className="grid-block"
                          role="gridcell"
                          aria-label="Black square"
                          key={`${rowIndex}:${colIndex}`}
                        />
                      );
                    }

                    const position = { row: rowIndex, col: colIndex };
                    const cellEntryId =
                      direction === "across"
                        ? cell.acrossEntryId
                        : cell.downEntryId;
                    const inSelectedEntry = Boolean(
                      selectedEntryId && cellEntryId === selectedEntryId,
                    );
                    const isSelected =
                      selectedCell?.row === rowIndex &&
                      selectedCell.col === colIndex;
                    const value = filled[`${rowIndex}:${colIndex}`] ?? "";

                    return (
                      <button
                        className={`grid-cell${inSelectedEntry ? " grid-cell--word" : ""}${isSelected ? " grid-cell--selected" : ""}`}
                        type="button"
                        role="gridcell"
                        aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}${cell.number ? `, number ${cell.number}` : ""}${value ? `, ${value}` : ", blank"}`}
                        aria-current={isSelected ? "true" : undefined}
                        key={`${rowIndex}:${colIndex}`}
                        onClick={() => selectCell(position)}
                      >
                        {cell.number && (
                          <span className="cell-number">{cell.number}</span>
                        )}
                        <span className="cell-letter">{value}</span>
                      </button>
                    );
                  }),
                )}
              </div>

              <div className="board-bottomline">
                <div className="progress-copy">
                  <span>{status === "solved" ? "SOLVED" : "IN PROGRESS"}</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="board-actions">
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={clearAnswers}
                  >
                    Clear
                  </button>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => generate()}
                  >
                    New puzzle <span aria-hidden="true">+</span>
                  </button>
                </div>
              </div>
            </section>

            <aside className="clue-section" aria-label="Clues">
              <div className="active-clue">
                <div className="active-clue-topline">
                  <span>
                    {selectedEntry
                      ? `${selectedEntry.number} ${selectedEntry.direction.toUpperCase()}`
                      : "SELECT A CLUE"}
                  </span>
                  {selectedEntry && (
                    <span>{selectedEntry.answer.length} LETTERS</span>
                  )}
                </div>
                <p>{selectedEntry?.clue ?? "Choose a clue to begin."}</p>
                {selectedEntry && (
                  <a
                    href={selectedEntry.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedEntry.puzzleName} / {selectedEntry.puzzleDate}{" "}
                    <span aria-hidden="true">+</span>
                  </a>
                )}
              </div>

              <div className="clue-toolbar" aria-label="Clue direction">
                <button
                  className={
                    direction === "across"
                      ? "direction-tab direction-tab--active"
                      : "direction-tab"
                  }
                  type="button"
                  onClick={() => setDirection("across")}
                >
                  Across <span>{acrossEntries.length}</span>
                </button>
                <button
                  className={
                    direction === "down"
                      ? "direction-tab direction-tab--active"
                      : "direction-tab"
                  }
                  type="button"
                  onClick={() => setDirection("down")}
                >
                  Down <span>{downEntries.length}</span>
                </button>
              </div>

              <div className="clue-lists">
                {[
                  {
                    title: "Across",
                    direction: "across" as const,
                    entries: acrossEntries,
                  },
                  {
                    title: "Down",
                    direction: "down" as const,
                    entries: downEntries,
                  },
                ].map(({ title, direction: clueDirection, entries }) => (
                  <section
                    className={`clue-list${direction === clueDirection ? " clue-list--mobile-active" : ""}`}
                    aria-label={`${title} clues`}
                    key={title}
                  >
                    <h2>
                      {title}
                      <span>{String(entries.length).padStart(2, "0")}</span>
                    </h2>
                    <ol>
                      {entries.map((entry) => (
                        <li key={entry.id}>
                          <button
                            className={
                              entry.id === selectedEntryId
                                ? "clue-button clue-button--active"
                                : "clue-button"
                            }
                            type="button"
                            onClick={() => selectEntry(entry.id)}
                          >
                            <span className="clue-number">{entry.number}</span>
                            <span className="clue-text">{entry.clue}</span>
                            <span className="clue-length">
                              {entry.answer.length}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </aside>
          </div>
        ) : (
          <div className="empty-state" role="status">
            Preparing your crossword...
          </div>
        )}
      </main>

      <footer className="site-footer">
        <p>
          Clues and answers sampled from{" "}
          <a
            href="https://cryptics.georgeho.org/"
            target="_blank"
            rel="noreferrer"
          >
            cryptics.georgeho.org
          </a>
          .
        </p>
        <p>
          Database:{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            target="_blank"
            rel="noreferrer"
          >
            ODbL 1.0
          </a>{" "}
          / Contents:{" "}
          <a
            href="https://opendatacommons.org/licenses/dbcl/1-0/"
            target="_blank"
            rel="noreferrer"
          >
            Database Contents License
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

export default App;
