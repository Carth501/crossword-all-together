# Wordplay Crossword

A compact, playable 9x9 cryptic crossword. Puzzle construction is a pure TypeScript module; the React client and Zustand store handle the active puzzle and solving interaction.

## Data

The client bundles a deduplicated sample of clue and answer records from [cryptics.georgeho.org](https://cryptics.georgeho.org/), which publishes more than 660,000 clues through a paginated JSON dataset. The sample is stored in `src/data/cryptic-clues.json` so the app works offline. Each record retains its original puzzle name, date, source, and source URL.

The database is made available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/); individual database contents are under the [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/). Attribution and license links are also shown in the app.

## Development

```sh
npm install
npm run dev
npm test
npm run build
npm run lint
```

The generator accepts clue records and a seed, and returns a puzzle model or a bounded failure result. It has no React, Zustand, or browser dependencies, so a server can call it directly when a backend is introduced.
