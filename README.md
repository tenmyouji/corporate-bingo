# Corporate Bingo

A browser-only React app for creating one playable 5x5 bingo card from a list of phrases.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Checks

```bash
npm test
npm run build
```

## Sharing

Share links store the normalized phrase list in the URL hash. They do not include the current card order or marked squares, so each recipient gets a fresh randomized card.
