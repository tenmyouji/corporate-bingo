import { describe, expect, it } from "vitest";
import { createBingoCard } from "./bingo";
import { buildShareUrl, decodePhrasesFromHash, encodePhrasesForHash } from "./share";

const phrases = Array.from({ length: 24 }, (_, index) => `Phrase ${index + 1}`);

describe("share links", () => {
  it("restores phrases from an encoded hash", () => {
    const hash = encodePhrasesForHash(phrases);

    expect(decodePhrasesFromHash(hash)).toEqual(phrases);
  });

  it("does not encode card order or marked squares", () => {
    const card = createBingoCard(phrases, () => 0.2).map((cell, index) =>
      index === 3 ? { ...cell, isMarked: true } : cell
    );
    const hash = encodePhrasesForHash(card.filter((cell) => !cell.isFree).map((cell) => cell.label));
    const restored = decodePhrasesFromHash(hash);

    expect(restored).toHaveLength(24);
    expect(hash).not.toContain("isMarked");
    expect(hash).not.toContain("free");
  });

  it("fails gracefully for invalid hashes", () => {
    expect(decodePhrasesFromHash("#phrases=not-valid")).toBeNull();
    expect(decodePhrasesFromHash("#other=value")).toBeNull();
  });

  it("builds a hash-based share URL", () => {
    const url = buildShareUrl("https://example.com", "/bingo", phrases);

    expect(url).toMatch(/^https:\/\/example\.com\/bingo#phrases=/);
  });
});
