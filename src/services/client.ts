import { API_BASE, REQUEST_TIMEOUT_MS, USER_AGENT } from "../constants.js";
import type { WhitneyListResponse, WhitneySingleResponse } from "../types.js";

/** Error carrying an actionable message for the model. */
export class WhitneyApiError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "WhitneyApiError";
    this.status = status;
  }
}

function messageForStatus(status: number, url: string): string {
  switch (status) {
    case 404:
      return `Not found (404): ${url}. Check the ID — artwork IDs are TMS IDs, and artist IDs are either a TMS ID or an internal reference prefixed with "T".`;
    case 429:
      return "Rate limited (429) by whitney.org. Wait a little before retrying, and prefer fewer, more specific requests.";
    case 500:
    case 502:
    case 503:
    case 504:
      return `The Whitney API returned ${status}. This is a problem at their end; retry in a moment.`;
    default:
      return `The Whitney API returned an unexpected status ${status} for ${url}.`;
  }
}

/**
 * Perform a GET against the Whitney API and parse the JSON body.
 *
 * @param path  Path below /api, e.g. "/artworks" or "/artists/962/artworks".
 * @param query Optional pre-built query parameters.
 */
export async function whitneyRequest<T>(path: string, query?: URLSearchParams): Promise<T> {
  const suffix = query && Array.from(query.keys()).length > 0 ? `?${query.toString()}` : "";
  const url = `${API_BASE}${path}${suffix}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new WhitneyApiError(messageForStatus(response.status, url), response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof WhitneyApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new WhitneyApiError(
        `Request to ${url} timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Try a narrower query.`,
      );
    }
    throw new WhitneyApiError(
      `Could not reach the Whitney API at ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function getList(path: string, query?: URLSearchParams): Promise<WhitneyListResponse> {
  return whitneyRequest<WhitneyListResponse>(path, query);
}

export function getOne(path: string): Promise<WhitneySingleResponse> {
  return whitneyRequest<WhitneySingleResponse>(path);
}

/** A Ransack filter map: predicate key to value, e.g. { title_cont: "moon" }. */
export type RansackFilters = Record<string, string | number | boolean | undefined>;

export interface QueryOptions {
  /** Ransack sort string, e.g. "title asc", "popularity desc", "random". */
  sort?: string;
  /** 1-based page number. */
  page?: number;
}

/**
 * Build the query string the Whitney API expects. Search and sort parameters are
 * nested under `q`, with sorting under `q[s]`; URLSearchParams handles encoding.
 */
export function buildQuery(filters: RansackFilters = {}, options: QueryOptions = {}): URLSearchParams {
  const params = new URLSearchParams();

  for (const [predicate, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    params.set(`q[${predicate}]`, String(value));
  }

  if (options.sort) params.set("q[s]", options.sort);
  if (options.page && options.page > 1) params.set("page", String(options.page));

  return params;
}

/** Map a friendly sort choice onto a Ransack sort string. */
export function resolveSort(
  sort: string | undefined,
  fieldMap: Record<string, string>,
): string | undefined {
  if (!sort || sort === "default") return undefined;
  return fieldMap[sort];
}
