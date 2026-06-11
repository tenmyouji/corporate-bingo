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
type DialogMode = "win" | "complete" | null;
type CopyStatus = "idle" | "copied" | "failed";
type WinResult = {
  plainText: string;
  html: string;
};

const phraseSets = [
  {
    name: "Standard corporate",
    phrases: [
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
    ]
  },
  {
    name: "AI company",
    phrases: [
      "AI-native",
      "Agentic workflow",
      "Human in the loop",
      "Model evals",
      "Prompt engineering",
      "Context window",
      "Synthetic data",
      "Fine-tuning",
      "Retrieval augmented",
      "Inference cost",
      "Latency budget",
      "Foundation model",
      "Safety layer",
      "Benchmark suite",
      "Token efficiency",
      "Multimodal roadmap",
      "Copilot experience",
      "Autonomous agents",
      "Model drift",
      "Guardrails",
      "GPU capacity",
      "AI transformation",
      "Hallucination rate",
      "Responsible AI",
      "AI-powered",
      "Workflow automation",
      "Knowledge graph",
      "Enterprise AI",
      "AI readiness",
      "Digital workforce",
      "Productivity unlock",
      "GenAI strategy",
      "AI adoption curve",
      "Prompt library",
      "LLM orchestration",
      "Vector database",
      "Semantic search",
      "RAG pipeline",
      "AI operating model",
      "Model governance",
      "Trust and safety",
      "Data flywheel",
      "AI-first culture",
      "Decision intelligence",
      "Augmented workforce",
      "No-code AI",
      "AI enablement",
      "Scalable intelligence",
      "Embedded AI",
      "Personalized at scale",
      "Human-AI collaboration",
      "AI center of excellence",
      "Model observability",
      "Explainable AI",
      "AI moat",
      "Automation dividend",
      "AI disruption",
      "Next-gen platform",
      "Data-driven insights",
      "Intelligent agents"
    ]
  },
  {
    name: "LinkedIn",
    phrases: [
      "I'm thrilled to announce",
      "Humbled and honored",
      "New chapter",
      "Big news",
      "Personal update",
      "Career milestone",
      "Excited to share",
      "After careful reflection",
      "Dream team",
      "Grateful for the opportunity",
      "Lessons learned",
      "Key takeaways",
      "Hot take",
      "Unpopular opinion",
      "Let's normalize this",
      "Say it louder",
      "This needs to be said",
      "Read that again",
      "Agree?",
      "Thoughts?",
      "What did I miss?",
      "Drop your thoughts below",
      "Follow me for more",
      "Commenting for visibility",
      "Hiring alert",
      "We're hiring",
      "Know anyone?",
      "My network is hiring",
      "Remote-first",
      "Hybrid work",
      "Work-life balance",
      "Authentic leadership",
      "Servant leadership",
      "Imposter syndrome",
      "Growth mindset",
      "Fail fast",
      "Build in public",
      "Personal brand",
      "Creator economy",
      "Community-led growth",
      "Networking is everything",
      "Your network is your net worth",
      "Optimize for learning",
      "Bet on yourself",
      "Do hard things",
      "Comfort zone",
      "Level up",
      "10x mindset",
      "High agency",
      "Founder mode",
      "Operator mindset",
      "Bias for action",
      "Customer obsessed",
      "People-first",
      "Culture add",
      "Inclusive workplace",
      "Psychological safety",
      "Radical candor",
      "Executive presence",
      "Strategic storytelling",
      "Data-driven decisions",
      "Impact over activity",
      "Outcome-focused",
      "Learning journey",
      "Mentorship matters",
      "Pay it forward",
      "Lift as you climb",
      "Monday motivation",
      "Friday reflection",
      "Sunday scaries",
      "Career pivot",
      "Portfolio career",
      "Fractional leader",
      "Solopreneur",
      "Side hustle",
      "Quiet quitting",
      "Loud quitting",
      "Bare minimum Monday"
    ]
  },
  {
    name: "Toxic manager",
    phrases: [
      "Be a team player",
      "This is a stretch goal",
      "We need more urgency",
      "No excuses",
      "Own the outcome",
      "Perception matters",
      "Let's not get defensive",
      "I need solutions",
      "This should be easy",
      "Everyone is replaceable",
      "You need thicker skin",
      "That's above your level",
      "Work smarter",
      "Not a good look",
      "I'll remember this",
      "Are you committed?",
      "We're a family",
      "Take accountability",
      "Manage up better",
      "This is basic",
      "Figure it out",
      "I don't want surprises",
      "You missed the mark",
      "Let's discuss offline"
    ]
  },
  {
    name: "Town hall",
    phrases: [
      "Exciting quarter ahead",
      "Record engagement",
      "Customer obsession",
      "Operational excellence",
      "Strategic pillars",
      "Leadership alignment",
      "Macroeconomic headwinds",
      "Employee experience",
      "Culture of innovation",
      "Questions in the chat",
      "Time for one more",
      "Transparent communication",
      "All-hands update",
      "Mission critical",
      "Growth mindset",
      "Cross-functional wins",
      "Financial discipline",
      "Our north star",
      "Big bets",
      "Customer stories",
      "People-first culture",
      "Values in action",
      "Thank you for all you do",
      "We'll follow up"
    ]
  }
];

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

    return "entry";
  });
  const [copyOnGenerate, setCopyOnGenerate] = useState(() => savedState?.copyOnGenerate ?? false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [winCopyStatus, setWinCopyStatus] = useState<CopyStatus>("idle");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

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

  useEffect(() => {
    if (winCopyStatus === "idle") {
      return;
    }

    const timer = window.setTimeout(() => setWinCopyStatus("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [winCopyStatus]);

  useEffect(() => {
    if (!dialogMode) {
      setWinCopyStatus("idle");
    }
  }, [dialogMode]);

  async function generateCard() {
    if (!canGenerate) {
      return;
    }

    setCard((current) => (current && cardMatchesPhrases(current, parsed.phrases) ? current : createBingoCard(parsed.phrases)));
    setView("card");
    setDialogMode(null);
    setWinCopyStatus("idle");

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
      await copyWinResultToClipboard(result);
      window.history.replaceState(null, "", encodePhrasesForHash(parsed.phrases));
      setWinCopyStatus("copied");
    } catch {
      setWinCopyStatus("failed");
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
    setDialogMode(null);
    setWinCopyStatus("idle");
  }

  function clearCard() {
    setCard((current) => (current ? clearMarkedCells(current) : current));
    setDialogMode(null);
    setWinCopyStatus("idle");
  }

  function editPhrases() {
    setDialogMode(null);
    setWinCopyStatus("idle");
    setView("entry");
  }

  function applyPhraseSet(name: string) {
    const phraseSet = phraseSets.find((set) => set.name === name);

    if (!phraseSet) {
      return;
    }

    setPhraseText(phraseSet.phrases.join("\n"));
  }

  function markCell(index: number) {
    setCard((current) => {
      if (!current) {
        return current;
      }

      const hadBingo = hasBingo(current);
      const nextCard = toggleCell(current, index);

      if (!hadBingo && hasBingo(nextCard)) {
        setDialogMode("win");
      } else if (dialogMode === null && !isCardComplete(current) && isCardComplete(nextCard)) {
        setDialogMode("complete");
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

          {dialogMode ? (
            <div className="modal-backdrop" role="presentation">
              <section className="win-dialog" role="dialog" aria-modal="true" aria-labelledby="win-title">
                <div className="win-dialog-body">
                  <h2 id="win-title">{dialogMode === "complete" ? "Card complete!" : "You won!"}</h2>
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
                  <p className={`copy-status win-copy-status ${winCopyStatus}`} aria-live="polite">
                    {winCopyStatus === "copied"
                      ? "Copied."
                      : winCopyStatus === "failed"
                        ? "Copy failed. Check browser clipboard permissions."
                        : " "}
                  </p>
                </div>
                <div className="win-dialog-actions">
                  {dialogMode === "win" ? (
                    <button type="button" className="primary" onClick={() => setDialogMode(null)}>
                      Keep playing
                    </button>
                  ) : null}
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
              <label className="phrase-set-picker">
                <span className="sr-only">Phrase set</span>
                <select defaultValue="" onChange={(event) => applyPhraseSet(event.target.value)}>
                  <option value="" disabled>
                    Choose phrase set
                  </option>
                  {phraseSets.map((phraseSet) => (
                    <option key={phraseSet.name} value={phraseSet.name}>
                      {phraseSet.name}
                    </option>
                  ))}
                </select>
              </label>
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
          <path d="m3 17 9.6-9.6a2.4 2.4 0 0 1 3.4 0l4.6 4.6a2.4 2.4 0 0 1 0 3.4L15 21H7Z" />
          <path d="m7 13 6 6" />
          <path d="M14 21h8" />
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

function cardMatchesPhrases(card: BingoCard, phrases: string[]): boolean {
  const phraseKeys = new Set(phrases.map((phrase) => phrase.toLocaleLowerCase()));
  return card
    .filter((cell) => !cell.isFree)
    .every((cell) => phraseKeys.has(cell.label.toLocaleLowerCase()));
}

async function copyWinResultToClipboard(result: WinResult) {
  if ("ClipboardItem" in window && "write" in navigator.clipboard) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([result.html], { type: "text/html" }),
        "text/plain": new Blob([result.plainText], { type: "text/plain" })
      })
    ]);
    return;
  }

  await navigator.clipboard.writeText(result.plainText);
}

function buildWinResult(card: BingoCard, shareUrl: string): WinResult {
  const winningIndexes = getWinningIndexes(card);
  const rows = Array.from({ length: 5 }, (_, rowIndex) =>
    card
      .slice(rowIndex * 5, rowIndex * 5 + 5)
      .map((_, cellIndex) => (winningIndexes.has(rowIndex * 5 + cellIndex) ? "🟪" : "⬜"))
      .join("")
  );
  const linkText = "#CorporteBingo";

  return {
    plainText: [...rows, "", `${linkText}: ${shareUrl}`].join("\n"),
    html: `${rows.join("<br>")}<br><br><a href="${escapeHtml(shareUrl)}">${linkText}</a>`
  };
}

function getWinningIndexes(card: BingoCard): Set<number> {
  return new Set(
    bingoConstants.winningLines
      .filter((line) => line.every((index) => card[index]?.isMarked))
      .flat()
  );
}

function isCardComplete(card: BingoCard): boolean {
  return card.every((cell) => cell.isMarked);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default App;
