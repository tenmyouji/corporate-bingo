import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export type SharePayload = {
  v: 1;
  phrases: string[];
};

const HASH_PREFIX = "#phrases=";

export function encodePhrasesForHash(phrases: string[]): string {
  const payload: SharePayload = { v: 1, phrases };
  return `${HASH_PREFIX}${compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

export function decodePhrasesFromHash(hash: string): string[] | null {
  if (!hash.startsWith(HASH_PREFIX)) {
    return null;
  }

  try {
    const compressed = hash.slice(HASH_PREFIX.length);
    const decompressed = decompressFromEncodedURIComponent(compressed);

    if (!decompressed) {
      return null;
    }

    const payload = JSON.parse(decompressed) as Partial<SharePayload>;

    if (payload.v !== 1 || !Array.isArray(payload.phrases)) {
      return null;
    }

    const phrases = payload.phrases.filter((phrase): phrase is string => typeof phrase === "string");
    return phrases.length > 0 ? phrases : null;
  } catch {
    return null;
  }
}

export function buildShareUrl(origin: string, pathname: string, phrases: string[]): string {
  return `${origin}${pathname}${encodePhrasesForHash(phrases)}`;
}
