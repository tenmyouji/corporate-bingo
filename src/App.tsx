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
              <div className="card-action-slot">
                <button type="button" onClick={editPhrases}>
                  <Icon name="edit" />
                  Edit phrases
                </button>
              </div>
              <div className="share-action">
                <button type="button" onClick={shareCard} disabled={!canGenerate}>
                  <Icon name="share" />
                  Share
                </button>
                <p className={`copy-status card-copy-status ${copyStatus}`} aria-live="polite">
                  {copyStatus === "copied"
                    ? "Share link copied. Recipients get a fresh randomized card."
                    : copyStatus === "failed"
                      ? "Copy failed. Check browser clipboard permissions."
                      : " "}
                </p>
              </div>
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
  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "arrow" ? (
        <>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </>
      ) : null}
      {name === "clear" ? (
        <>
          <path d="m7 21 10-10" />
          <path d="m15 5 4 4" />
          <path d="m5 19 4 4" />
          <path d="m3 21 3.5-3.5" />
          <path d="m14 6 3-3 4 4-3 3" />
        </>
      ) : null}
      {name === "edit" ? (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          <path d="m15 5 3 3" />
        </>
      ) : null}
      {name === "share" ? (
        <>
          <path d="M12 3v12" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </>
      ) : null}
      {name === "shuffle" ? (
        <>
          <path d="M16 3h5v5" />
          <path d="M4 7h3a6 6 0 0 1 5 3l1 2a6 6 0 0 0 5 3h3" />
          <path d="M4 17h3a6 6 0 0 0 5-3l1-2a6 6 0 0 1 5-3h3" />
          <path d="m16 21 5-5-5-5" />
        </>
      ) : null}
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
