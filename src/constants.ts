/** Base URL for the Whitney Museum public API. */
export const API_BASE = "https://whitney.org/api";

/** Sent so the Museum can see who is calling; be a good citizen. */
export const USER_AGENT = "whitney-mcp-server/0.1.0 (+https://whitney.org/about/website/api)";

/** Abort a request after this many milliseconds. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Maximum characters returned in a single tool response. Whitney records carry
 * long HTML descriptions and biographies, so responses are trimmed before they
 * reach the model's context.
 */
export const CHARACTER_LIMIT = 25_000;

/** The API returns a fixed page size; results are trimmed client-side. */
export const API_PAGE_SIZE = 30;

/** Longest a stripped description or biography may be in a full record. */
export const PROSE_LIMIT = 2_000;

/**
 * Classification values use specific casing in the API. This list is a hint for
 * the model, not an exhaustive enumeration — other values may exist.
 */
export const COMMON_CLASSIFICATIONS = [
  "Paintings",
  "Drawings",
  "Prints",
  "Photographs",
  "Sculpture",
  "Installations",
  "Film and Video",
  "Time-based Media",
] as const;
