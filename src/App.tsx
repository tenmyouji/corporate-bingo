import { useEffect, useMemo, useState } from "react";
import type { BingoCard } from "./bingo";
import { bingoConstants, createBingoCard, parsePhrases, restoreFreeSpace, toggleCell } from "./bingo";
import { buildShareUrl, decodePhrasesFromHash, encodePhrasesForHash } from "./share";
import { loadSavedState, saveState } from "./storage";

type AppView = "entry" | "card";

const samplePhrases = [
  "Circle back",
  "Take this offline",
  "Low-hanging fruit",
  "Bandwidth",
  "Deep dive",
  "Quick sync",
  "Move the needle",
  "Align on next steps",
  "Action item",
  "Table stakes",
  "Hard stop",
  "Parking lot",
  "Ping me",
  "North star",
  "Stakeholder buy-in",
  "Thought leadership",
  "At scale",
  "Unlock value",
  "Close the loop",
  "Single source of truth",
  "Best practice",
  "Net-new",
  "Strategic priority",
  "Run it up the flagpole"
].join("\n");

function App() {
  const sharedPhrases = useMemo(() => decodePhrasesFromHash(window.location.hash), []);
  const savedState = useMemo(() => loadSavedState(), []);
  const [phraseText, setPhraseText] = useState(() => {
    if (sharedPhrases) {
      return sharedPhrases.join("\n");
    }

    return savedState?.phraseText ?? samplePhrases;
  });
  const [card, setCard] = useState<BingoCard | null>(() => {
    if (sharedPhrases) {
      return createCardFromText(sharedPhrases.join("\n"));
    }

    return savedState?.card ? restoreFreeSpace(savedState.card) : null;
  });
  const [view, setView] = useState<AppView>(() => {
    if (sharedPhrases) {
      return "card";
    }

    return savedState?.view === "card" && savedState.card ? "card" : "entry";
  });
  const [copyOnGenerate, setCopyOnGenerate] = useState(() => savedState?.copyOnGenerate ?? false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const parsed = useMemo(() => parsePhrases(phraseText), [phraseText]);
  const canGenerate = parsed.errors.length === 0;
  const markedCount = card?.filter((cell) => cell.isMarked).length ?? 0;

  useEffect(() => {
    saveState({ phraseText, card, view, copyOnGenerate });
  }, [phraseText, card, view, copyOnGenerate]);

  useEffect(() => {
    if (copyStatus === "idle") {
      return;
    }

    const timer = window.setTimeout(() => setCopyStatus("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  async function generateCard() {
    if (!canGenerate) {
      return;
    }

    setCard(createBingoCard(parsed.phrases));
    setView("card");

    if (copyOnGenerate) {
      await copyShareLink();
    }
  }

  async function shareCard() {
    if (!canGenerate) {
      return;
    }

    await copyShareLink();
  }

  async function copyShareLink() {
    const url = buildShareUrl(window.location.origin, window.location.pathname, parsed.phrases);

    try {
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", encodePhrasesForHash(parsed.phrases));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function shuffleCard() {
    if (!canGenerate) {
      return;
    }

    setCard(createBingoCard(parsed.phrases));
  }

  if (view === "card" && card) {
    return (
      <main className="app card-app">
        <section className="card-view" aria-labelledby="board-title">
          <header className="card-menu">
            <div>
              <p className="eyebrow">Corporate Bingo</p>
              <h1 id="board-title">{markedCount} of 25 marked</h1>
            </div>
            <nav className="menu-actions" aria-label="Card actions">
              <button type="button" onClick={() => setView("entry")}>
                Edit
              </button>
              <button type="button" onClick={shareCard} disabled={!canGenerate}>
                Share
              </button>
              <button type="button" onClick={shuffleCard} disabled={!canGenerate}>
                Shuffle
              </button>
            </nav>
          </header>

          <p className={`copy-status card-copy-status ${copyStatus}`} aria-live="polite">
            {copyStatus === "copied"
              ? "Share link copied. Recipients get a fresh randomized card."
              : copyStatus === "failed"
                ? "Copy failed. Check browser clipboard permissions."
                : " "}
          </p>

          <div className="bingo-board" role="grid" aria-label="Bingo card">
            {card.map((cell, index) => (
              <button
                key={`${cell.id}-${index}`}
                type="button"
                className={`cell ${cell.isMarked ? "marked" : ""} ${cell.isFree ? "free" : ""}`}
                onClick={() => setCard((current) => (current ? toggleCell(current, index) : current))}
                aria-pressed={cell.isMarked}
                role="gridcell"
              >
                <span>{cell.label}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app entry-app">
      <section className="workspace" aria-labelledby="app-title">
        <div className="intro">
          <p className="eyebrow">Corporate Bingo</p>
          <h1 id="app-title">Build a meeting-ready bingo card.</h1>
          <p>
            Paste one phrase per line. Generate a 5x5 card, tap squares as they happen, and share the phrase list
            without sharing your current board.
          </p>
        </div>

        <div className="controls-panel">
          <div className="field-header">
            <label htmlFor="phrases">Phrases</label>
            <span>{parsed.phrases.length} unique</span>
          </div>
          <textarea
            id="phrases"
            value={phraseText}
            onChange={(event) => setPhraseText(event.target.value)}
            spellCheck="true"
            aria-describedby="phrase-help phrase-errors"
          />
          <div className="field-footer" id="phrase-help">
            <span>{bingoConstants.requiredPhrases} phrases needed for one card.</span>
            {parsed.duplicates.length > 0 ? <span>{parsed.duplicates.length} duplicate removed</span> : null}
          </div>

          <div className="validation" id="phrase-errors" aria-live="polite">
            {parsed.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>

          <div className="actions">
            <button type="button" className="primary" onClick={generateCard} disabled={!canGenerate}>
              Generate card
            </button>
            <label className="share-option">
              <input
                type="checkbox"
                checked={copyOnGenerate}
                onChange={(event) => setCopyOnGenerate(event.target.checked)}
              />
              <span>Copy share link to clipboard</span>
            </label>
          </div>

          <p className={`copy-status ${copyStatus}`} aria-live="polite">
            {copyStatus === "copied"
              ? "Share link copied. Recipients get a fresh randomized card."
              : copyStatus === "failed"
                ? "Copy failed. Check browser clipboard permissions."
                : " "}
          </p>
        </div>
      </section>
    </main>
  );
}

function createCardFromText(text: string): BingoCard | null {
  const parsed = parsePhrases(text);
  return parsed.errors.length === 0 ? createBingoCard(parsed.phrases) : null;
}

export default App;
