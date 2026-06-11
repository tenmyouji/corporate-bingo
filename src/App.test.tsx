import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { encodePhrasesForHash } from "./share";

const phrases = Array.from({ length: 24 }, (_, index) => `Phrase ${index + 1}`);

describe("App two-step flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts on phrase entry without showing a board", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Corporate Bingo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate card" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Phrase set" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Copy share link to clipboard" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Paste one phrase per line. Generate a 5x5 card, tap squares as they happen, and share the phrase list without sharing your current board. A minimum of 24 phrases needed for one card."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("0 unique phrases")).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Bingo card" })).not.toBeInTheDocument();
  });

  it("applies a preset phrase set from the phrase entry page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Phrase set" }), "AI company");

    const textarea = screen.getByRole("textbox", { name: "Phrases" }) as HTMLTextAreaElement;
    expect(textarea.value).toContain("AI-native");
    expect(textarea.value).toContain("Responsible AI");
    expect(screen.getByText("60 unique phrases")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate card" })).toBeEnabled();
  });

  it("applies the LinkedIn phrase preset", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Phrase set" }), "LinkedIn");

    const textarea = screen.getByRole("textbox", { name: "Phrases" }) as HTMLTextAreaElement;
    expect(textarea.value).toContain("I'm thrilled to announce");
    expect(textarea.value).toContain("Bare minimum Monday");
    expect(screen.getByRole("button", { name: "Generate card" })).toBeEnabled();
  });

  it("clears phrases from the entry page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Phrase set" }), "Standard corporate");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("textbox", { name: "Phrases" })).toHaveValue("");
    expect(screen.getByText("0 unique phrases")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate card" })).toBeDisabled();
  });

  it("generates a card and moves to the card step", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit phrases" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Phrases" })).not.toBeInTheDocument();
  });

  it("copies a share link while generating when the checkbox is selected", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("checkbox", { name: "Copy share link to clipboard" }));
    await user.click(screen.getByRole("button", { name: "Generate card" }));

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(await screen.findByText("Share link copied. Recipients get a fresh randomized card.")).toBeInTheDocument();
  });

  it("opens shared links directly on a fresh card", async () => {
    window.history.replaceState(null, "", encodePhrasesForHash(phrases));

    render(<App />);

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit phrases" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Phrases" })).not.toBeInTheDocument();
  });

  it("returns to phrase entry from Edit without discarding the card", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    await user.click(await screen.findByRole("button", { name: "Edit phrases" }));

    expect(screen.getByRole("textbox", { name: "Phrases" })).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Bingo card" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate card" }));

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
  });

  it("shares from the card menu without changing marked squares", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");
    await user.click(cells[0]);

    const markedBeforeShare = markedCells().length;
    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() =>
      expect(screen.getByText("Share link copied. Recipients get a fresh randomized card.")).toBeInTheDocument()
    );
    expect(markedCells()).toHaveLength(markedBeforeShare);
  });

  it("shuffle creates a playable fresh card and clears non-free marked squares", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");
    await user.click(cells[0]);

    expect(markedCells()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Shuffle" }));

    expect(markedCells()).toHaveLength(1);
    expect(screen.getByText("FREE").closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("clear removes non-free marks without changing the card", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");
    const firstLabel = cells[0].textContent;
    await user.click(cells[0]);

    expect(markedCells()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(markedCells()).toHaveLength(1);
    expect(screen.getByText(firstLabel ?? "")).toBeInTheDocument();
    expect(screen.getByText("FREE").closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("marks phrase squares separately from the free space for cross-out styling", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");

    await user.click(cells[0]);

    expect(cells[0]).toHaveClass("marked");
    expect(cells[0]).not.toHaveClass("free");
    expect(screen.getByText("FREE").closest("button")).toHaveClass("marked", "free");
  });

  it("shows a win dialog when a row is completed", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");

    for (const cell of cells.slice(0, 5)) {
      await user.click(cell);
    }

    const dialog = screen.getByRole("dialog", { name: "You won!" });

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Keep playing" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Generate new card" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Edit phrases" })).toBeInTheDocument();
  });

  it("highlights only the winning line in the win dialog preview", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");
    await user.click(cells[6]);

    for (const cell of cells.slice(0, 5)) {
      await user.click(cell);
    }

    const dialog = screen.getByRole("dialog", { name: "You won!" });
    expect(dialog.querySelectorAll(".win-grid span.marked")).toHaveLength(5);
  });

  it("highlights multiple winning lines completed by one final mark", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");

    for (const index of [1, 2, 3, 4, 5, 10, 15, 20]) {
      await user.click(cells[index]);
    }

    await user.click(cells[0]);

    const dialog = screen.getByRole("dialog", { name: "You won!" });
    expect(dialog.querySelectorAll(".win-grid span.marked")).toHaveLength(9);
  });

  it("copies a Wordle-style result and share link from the win dialog", async () => {
    render(<App />);

    fillValidPhrases();
    fireEvent.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");

    for (const cell of cells.slice(0, 5)) {
      fireEvent.click(cell);
    }

    const dialog = screen.getByRole("dialog", { name: "You won!" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());

    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copiedText).toMatch(/^🟪🟪🟪🟪🟪\n/);
    expect(copiedText).toContain("🟪🟪🟪🟪🟪");
    expect(copiedText).toContain("#CorporteBingo: ");
    expect(copiedText).toContain("#phrases=");
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
    expect(screen.queryByText("Share link copied. Recipients get a fresh randomized card.")).not.toBeInTheDocument();
  });

  it("copies a linked hashtag from the win dialog when rich clipboard is available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const nativeBlob = globalThis.Blob;
    class BlobMock {
      parts: string[];
      type: string;

      constructor(parts: string[], options?: { type?: string }) {
        this.parts = parts;
        this.type = options?.type ?? "";
      }
    }
    class ClipboardItemMock {
      items: Record<string, BlobMock>;

      constructor(items: Record<string, BlobMock>) {
        this.items = items;
      }
    }

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write,
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
    Object.defineProperty(window, "ClipboardItem", {
      configurable: true,
      value: ClipboardItemMock
    });
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      value: BlobMock
    });

    render(<App />);

    fillValidPhrases();
    fireEvent.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");

    for (const cell of cells.slice(0, 5)) {
      fireEvent.click(cell);
    }

    const dialog = screen.getByRole("dialog", { name: "You won!" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(write).toHaveBeenCalled());

    const clipboardItem = write.mock.calls[0][0][0] as ClipboardItemMock;
    const html = clipboardItem.items["text/html"].parts.join("");
    expect(html).toContain('href="http://localhost:3000/#phrases=');
    expect(html).toContain(">#CorporteBingo</a>");
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      value: nativeBlob
    });
  });

  it("shows a completion dialog without Keep playing after finishing the card", async () => {
    const user = userEvent.setup();
    render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");

    for (const cell of cells.slice(0, 5)) {
      await user.click(cell);
    }

    await user.click(within(screen.getByRole("dialog", { name: "You won!" })).getByRole("button", { name: "Keep playing" }));

    for (const cell of cells) {
      if (cell.getAttribute("aria-pressed") === "false") {
        await user.click(cell);
      }
    }

    const dialog = screen.getByRole("dialog", { name: "Card complete!" });
    expect(within(dialog).queryByRole("button", { name: "Keep playing" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Generate new card" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Edit phrases" })).toBeInTheDocument();
  });

  it("starts on phrase entry after refresh while preserving the saved card", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");
    const markedLabel = cells[0].textContent ?? "";
    await user.click(cells[0]);

    expect(markedCells()).toHaveLength(2);

    unmount();
    render(<App />);

    expect(screen.getByRole("textbox", { name: "Phrases" })).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Bingo card" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate card" }));

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(screen.getByText(markedLabel).closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("FREE").closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(markedCells()).toHaveLength(2);
  });

  it("restores the phrase entry step after returning to Edit and refreshing", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    await user.click(await screen.findByRole("button", { name: "Edit phrases" }));

    unmount();
    render(<App />);

    expect(screen.getByRole("textbox", { name: "Phrases" })).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Bingo card" })).not.toBeInTheDocument();
  });

  it("restores the copy-on-generate checkbox preference after a refresh", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByRole("checkbox", { name: "Copy share link to clipboard" }));

    unmount();
    render(<App />);

    expect(screen.getByRole("checkbox", { name: "Copy share link to clipboard" })).toBeChecked();
  });

  it("lets shared links override saved local progress", async () => {
    const user = userEvent.setup();
    const sharedPhrases = Array.from({ length: 24 }, (_, index) => `Shared phrase ${index + 1}`);
    const { unmount } = render(<App />);

    fillValidPhrases();
    await user.click(screen.getByRole("button", { name: "Generate card" }));
    await screen.findByRole("grid", { name: "Bingo card" });

    unmount();
    window.history.replaceState(null, "", encodePhrasesForHash(sharedPhrases));
    render(<App />);

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(screen.getByText("Shared phrase 1")).toBeInTheDocument();
    expect(screen.queryByText("Circle back")).not.toBeInTheDocument();
  });
});

function markedCells() {
  return screen.getAllByRole("gridcell").filter((cell) => cell.getAttribute("aria-pressed") === "true");
}

function fillValidPhrases() {
  fireEvent.change(screen.getByRole("textbox", { name: "Phrases" }), {
    target: { value: phrases.join("\n") }
  });
}
