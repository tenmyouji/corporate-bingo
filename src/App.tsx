import { useEffect, useMemo, useState } from "react";
import type { BingoCard } from "./bingo";
import {
  bingoConstants,
  clearMarkedCells,
  createBingoCard,
  hasBingo,
  parsePhrases,
  restoreFreeSpace,
  toggleCell
} from "./bingo";
import { buildShareUrl, decodePhrasesFromHash, encodePhrasesForHash } from "./share";
import { loadSavedState, saveState } from "./storage";

type AppView = "entry" | "card";

function App() {
  const sharedPhrases = useMemo(() => decodePhrasesFromHash(window.location.hash), []);
  const savedState = useMemo(() => loadSavedState(), []);
  const savedCard = useMemo(() => restoreSavedCard(savedState?.card), [savedState]);
  const [phraseText, setPhraseText] = useState(() => {
    if (sharedPhrases) {
      return sharedPhrases.join("\n");
    }

    return savedState?.phraseText ?? "";
  });
  const [card, setCard] = useState<BingoCard | null>(() => {
    if (sharedPhrases) {
      return createCardFromText(sharedPhrases.join("\n"));
    }

    return savedCard;
  });
  const [view, setView] = useState<AppView>(() => {
    if (sharedPhrases) {
      return "card";
    }

    return savedState?.view === "card" && savedCard ? "card" : "entry";
  });
  const [copyOnGenerate, setCopyOnGenerate] = useState(() => savedState?.copyOnGenerate ?? false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [showWinDialog, setShowWinDialog] = useState(false);

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
    setShowWinDialog(false);

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
    setShowWinDialog(false);
  }

  function clearCard() {
    setCard((current) => (current ? clearMarkedCells(current) : current));
    setShowWinDialog(false);
  }

  function editPhrases() {
    setShowWinDialog(false);
    setView("entry");
  }

  function markCell(index: number) {
    setCard((current) => {
      if (!current) {
        return current;
      }

      const hadBingo = hasBingo(current);
      const nextCard = toggleCell(current, index);

      if (!hadBingo && hasBingo(nextCard)) {
        setShowWinDialog(true);
      }

      return nextCard;
    });
  }

  if (view === "card" && card) {
    return (
      <main className="app card-app">
        <section className="card-view" aria-labelledby="board-title">
          <h1 id="board-title" className="sr-only">
            Corporate Bingo card, {markedCount} of 25 marked
          </h1>

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
                onClick={() => markCell(index)}
                aria-pressed={cell.isMarked}
                role="gridcell"
              >
                <span>{cell.label}</span>
              </button>
            ))}
          </div>

          <nav className="card-actions" aria-label="Card actions">
            <div className="action-group">
              <button type="button" onClick={shuffleCard} disabled={!canGenerate}>
                <Icon name="shuffle" />
                Shuffle
              </button>
              <button type="button" onClick={clearCard}>
                <Icon name="clear" />
                Clear
              </button>
            </div>
            <div className="action-group">
              <button type="button" onClick={editPhrases}>
                <Icon name="edit" />
                Edit phrases
              </button>
              <button type="button" onClick={shareCard} disabled={!canGenerate}>
                <Icon name="share" />
                Share
              </button>
            </div>
          </nav>

          {showWinDialog ? (
            <div className="modal-backdrop" role="presentation">
              <section className="win-dialog" role="dialog" aria-modal="true" aria-labelledby="win-title">
                <div className="win-dialog-body">
                  <h2 id="win-title">You won!</h2>
                  <p>Share with your team:</p>
                  <div className="win-grid" aria-hidden="true">
                    {card.map((cell, index) => (
                      <span key={`${cell.id}-win-${index}`} className={cell.isMarked ? "marked" : ""} />
                    ))}
                  </div>
                  <button type="button" className="copy-win-button" onClick={shareCard}>
                    Copy
                  </button>
                </div>
                <div className="win-dialog-actions">
                  <button type="button" className="primary" onClick={() => setShowWinDialog(false)}>
                    Keep playing
                  </button>
                  <button type="button" onClick={shuffleCard}>
                    Generate new card
                  </button>
                  <button type="button" onClick={editPhrases}>
                    Edit phrases
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app entry-app">
      <section className="workspace" aria-labelledby="app-title">
        <div className="controls-panel">
          <div className="intro">
            <h1 id="app-title">Corporate Bingo</h1>
            <p>
              Paste one phrase per line. Generate a 5x5 card, tap squares as they happen, and share the phrase list
              without sharing your current board. A minimum of 24 phrases needed for one card.
            </p>
          </div>

          <div className="field-header">
            <label htmlFor="phrases" className="sr-only">
              Phrases
            </label>
          </div>
          <textarea
            id="phrases"
            value={phraseText}
            onChange={(event) => setPhraseText(event.target.value)}
            spellCheck="true"
            aria-describedby="phrase-help phrase-errors"
            placeholder="Phrase 1"
          />

          <div className="validation" id="phrase-errors" aria-live="polite">
            {parsed.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>

          <div className="entry-footer" id="phrase-help">
            <span>
              {parsed.phrases.length} unique phrase{parsed.phrases.length === 1 ? "" : "s"}
            </span>
            <div className="entry-actions">
              <label className="share-option">
                <input
                  type="checkbox"
                  checked={copyOnGenerate}
                  onChange={(event) => setCopyOnGenerate(event.target.checked)}
                />
                <span>Copy share link to clipboard</span>
              </label>
              <button type="button" className="primary" onClick={generateCard} disabled={!canGenerate}>
                Generate card
                <Icon name="arrow" />
              </button>
            </div>
          </div>

          <p>
            {parsed.duplicates.length > 0 ? `${parsed.duplicates.length} duplicate removed` : " "}
          </p>

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

function Icon({ name }: { name: "arrow" | "clear" | "edit" | "share" | "shuffle" }) {
  const paths = {
    arrow: "M5 12h14m-6-6 6 6-6 6",
    clear: "m4 16 4-4-4-4m4 4h12",
    edit: "M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4Zm10-13 3 3",
    share: "M12 16V4m0 0 4 4m-4-4-4 4M5 12v7h14v-7",
    shuffle: "M16 3h5v5M4 7h4c5 0 5 10 10 10h3M4 17h4c1.5 0 2.6-.9 3.6-2.2M14 5.2C15 4 16.2 3 18 3h3"
  };

  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function createCardFromText(text: string): BingoCard | null {
  const parsed = parsePhrases(text);
  return parsed.errors.length === 0 ? createBingoCard(parsed.phrases) : null;
}

function restoreSavedCard(card: BingoCard | null | undefined): BingoCard | null {
  return Array.isArray(card) && card.length === bingoConstants.cardSize ? restoreFreeSpace(card) : null;
}

export default App;
