import type { BingoCard } from "./bingo";

export type SavedState = {
  phraseText: string;
  card: BingoCard | null;
  view?: "entry" | "card";
  copyOnGenerate?: boolean;
};

const STORAGE_KEY = "corporate-bingo-state";

export function loadSavedState(): SavedState | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as SavedState) : null;
  } catch {
    return null;
  }
}

export function saveState(state: SavedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in private windows or locked-down browsers.
  }
}
