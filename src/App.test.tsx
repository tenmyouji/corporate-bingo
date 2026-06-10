import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("heading", { name: "Build a meeting-ready bingo card." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate card" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Copy share link to clipboard" })).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Bingo card" })).not.toBeInTheDocument();
  });

  it("generates a card and moves to the card step", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Generate card" }));

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Phrases" })).not.toBeInTheDocument();
  });

  it("copies a share link while generating when the checkbox is selected", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("checkbox", { name: "Copy share link to clipboard" }));
    await user.click(screen.getByRole("button", { name: "Generate card" }));

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(await screen.findByText("Share link copied. Recipients get a fresh randomized card.")).toBeInTheDocument();
  });

  it("opens shared links directly on a fresh card", async () => {
    window.history.replaceState(null, "", encodePhrasesForHash(phrases));

    render(<App />);

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Phrases" })).not.toBeInTheDocument();
  });

  it("returns to phrase entry from Edit without discarding the card", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Generate card" }));
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox", { name: "Phrases" })).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Bingo card" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate card" }));

    expect(await screen.findByRole("grid", { name: "Bingo card" })).toBeInTheDocument();
  });

  it("shares from the card menu without changing marked squares", async () => {
    const user = userEvent.setup();
    render(<App />);

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

    await user.click(screen.getByRole("button", { name: "Generate card" }));
    const cells = await screen.findAllByRole("gridcell");
    await user.click(cells[0]);

    expect(markedCells()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Shuffle" }));

    expect(markedCells()).toHaveLength(1);
    expect(screen.getByText("FREE").closest("button")).toHaveAttribute("aria-pressed", "true");
  });
});

function markedCells() {
  return screen.getAllByRole("gridcell").filter((cell) => cell.getAttribute("aria-pressed") === "true");
}
