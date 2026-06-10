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

const standardPhrases = [
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

  async function copyWinResult() {
    if (!canGenerate || !card) {
      return;
    }

    const url = buildShareUrl(window.location.origin, window.location.pathname, parsed.phrases);
    const result = buildWinResult(card, url);

    try {
      await navigator.clipboard.writeText(result);
      window.history.replaceState(null, "", encodePhrasesForHash(parsed.phrases));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
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

  function restoreStandardPhrases() {
    setPhraseText(standardPhrases);
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
                      <span
                        key={`${cell.id}-win-${index}`}
                        className={getWinningIndexes(card).has(index) ? "marked" : ""}
                      />
                    ))}
                  </div>
                  <button type="button" className="copy-win-button" onClick={copyWinResult}>
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
              <button type="button" className="secondary" onClick={restoreStandardPhrases}>
                Standard phrases
              </button>
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
          <path d="m7 21-4-4 9.2-9.2a2.8 2.8 0 0 1 4 0l2 2a2.8 2.8 0 0 1 0 4L11 21" />
          <path d="M22 21H7" />
          <path d="m5 19 5-5" />
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
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
        </>
      ) : null}
      {name === "shuffle" ? (
        <>
          <path d="m18 14 4 4-4 4" />
          <path d="m18 2 4 4-4 4" />
          <path d="M2 18h1.4a7 7 0 0 0 5.1-2.2l7-7A7 7 0 0 1 20.6 6H22" />
          <path d="M2 6h1.4a7 7 0 0 1 5.1 2.2l1.2 1.2" />
          <path d="M14.3 14.6 15.5 16a7 7 0 0 0 5.1 2H22" />
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

function buildWinResult(card: BingoCard, shareUrl: string): string {
  const winningIndexes = getWinningIndexes(card);
  const rows = Array.from({ length: 5 }, (_, rowIndex) =>
    card
      .slice(rowIndex * 5, rowIndex * 5 + 5)
      .map((_, cellIndex) => (winningIndexes.has(rowIndex * 5 + cellIndex) ? "🟪" : "⬜"))
      .join("")
  );

  return ["Corporate Bingo", "", ...rows, "", shareUrl].join("\n");
}

function getWinningIndexes(card: BingoCard): Set<number> {
  return new Set(
    bingoConstants.winningLines
      .filter((line) => line.every((index) => card[index]?.isMarked))
      .flat()
  );
}

export default App;
