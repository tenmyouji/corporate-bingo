import { describe, expect, it } from "vitest";
import { bingoConstants, createBingoCard, parsePhrases } from "./bingo";

const phrases = Array.from({ length: 30 }, (_, index) => `Phrase ${index + 1}`);

describe("parsePhrases", () => {
  it("trims input and ignores blank lines", () => {
    const result = parsePhrases("  First phrase  \n\nSecond phrase\n");

    expect(result.phrases).toEqual(["First phrase", "Second phrase"]);
  });

  it("rejects fewer than 24 unique phrases", () => {
    const result = parsePhrases("One\nTwo\nThree");

    expect(result.errors).toContain("Add 21 more phrases.");
  });

  it("detects duplicates case-insensitively", () => {
    const result = parsePhrases("Budget sync\nbudget sync\nBUDGET SYNC");

    expect(result.phrases).toEqual(["Budget sync"]);
    expect(result.duplicates).toEqual(["budget sync", "BUDGET SYNC"]);
    expect(result.errors).toContain("Remove 2 duplicate phrases.");
  });

  it("allows more than 24 phrases", () => {
    const result = parsePhrases(phrases.join("\n"));

    expect(result.phrases).toHaveLength(30);
    expect(result.errors).toEqual([]);
  });
});

describe("createBingoCard", () => {
  it("creates a 25-cell card with a marked center free space", () => {
    const card = createBingoCard(phrases, () => 0.5);

    expect(card).toHaveLength(bingoConstants.cardSize);
    expect(card[bingoConstants.freeIndex]).toMatchObject({
      label: "FREE",
      isFree: true,
      isMarked: true
    });
    expect(card.filter((cell) => !cell.isFree)).toHaveLength(24);
  });

  it("uses exactly 24 phrase cells even when more phrases are supplied", () => {
    const card = createBingoCard(phrases);

    expect(card.filter((cell) => !cell.isFree).map((cell) => cell.label)).toHaveLength(24);
  });

  it("varies generated layouts", () => {
    const layouts = new Set(
      Array.from({ length: 20 }, () =>
        createBingoCard(phrases)
          .map((cell) => cell.label)
          .join("|")
      )
    );

    expect(layouts.size).toBeGreaterThan(1);
  });
});
