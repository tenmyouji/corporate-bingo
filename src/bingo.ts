export type Phrase = string;

export type CardCell = {
  id: string;
  label: string;
  isFree: boolean;
  isMarked: boolean;
};

export type BingoCard = CardCell[];

export type ParsedPhrases = {
  phrases: Phrase[];
  duplicates: Phrase[];
  errors: string[];
};

const REQUIRED_PHRASES = 24;
const CARD_SIZE = 25;
const FREE_INDEX = 12;
const WINNING_LINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20]
];

export function parsePhrases(input: string): ParsedPhrases {
  const seen = new Map<string, string>();
  const phrases: Phrase[] = [];
  const duplicates: Phrase[] = [];

  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((phrase) => {
      const key = phrase.toLocaleLowerCase();

      if (seen.has(key)) {
        duplicates.push(phrase);
        return;
      }

      seen.set(key, phrase);
      phrases.push(phrase);
    });

  const errors: string[] = [];

  if (phrases.length < REQUIRED_PHRASES) {
    errors.push(`Add ${REQUIRED_PHRASES - phrases.length} more phrase${REQUIRED_PHRASES - phrases.length === 1 ? "" : "s"}.`);
  }

  return { phrases, duplicates, errors };
}

export function createBingoCard(phrases: Phrase[], random = Math.random): BingoCard {
  if (phrases.length < REQUIRED_PHRASES) {
    throw new Error("At least 24 phrases are required to create a bingo card.");
  }

  const selectedPhrases = shuffle(phrases, random).slice(0, REQUIRED_PHRASES);
  let phraseIndex = 0;

  return Array.from({ length: CARD_SIZE }, (_, index) => {
    if (index === FREE_INDEX) {
      return {
        id: "free",
        label: "FREE",
        isFree: true,
        isMarked: true
      };
    }

    const label = selectedPhrases[phraseIndex];
    phraseIndex += 1;

    return {
      id: `${index}-${label}`,
      label,
      isFree: false,
      isMarked: false
    };
  });
}

export function toggleCell(card: BingoCard, index: number): BingoCard {
  return card.map((cell, cellIndex) => {
    if (cellIndex !== index || cell.isFree) {
      return cell;
    }

    return { ...cell, isMarked: !cell.isMarked };
  });
}

export function clearMarkedCells(card: BingoCard): BingoCard {
  return card.map((cell, index) => ({
    ...cell,
    isMarked: index === FREE_INDEX || cell.isFree
  }));
}

export function restoreFreeSpace(card: BingoCard): BingoCard {
  return card.map((cell, index) => {
    if (index === FREE_INDEX || cell.isFree) {
      return { ...cell, isFree: true, isMarked: true, label: "FREE", id: "free" };
    }

    return cell;
  });
}

export function hasBingo(card: BingoCard): boolean {
  if (card.length !== CARD_SIZE) {
    return false;
  }

  return WINNING_LINES.some((line) => line.every((index) => card[index]?.isMarked));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export const bingoConstants = {
  requiredPhrases: REQUIRED_PHRASES,
  cardSize: CARD_SIZE,
  freeIndex: FREE_INDEX,
  winningLines: WINNING_LINES
};
