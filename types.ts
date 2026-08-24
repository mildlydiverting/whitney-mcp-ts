/**
 * The Whitney API roughly follows the JSON:API specification: every record is a
 * resource object with `id`, `type` and an `attributes` bag. Attribute keys vary
 * by record type and are explicitly documented as subject to change, so they are
 * typed loosely and read defensively.
 */
export interface WhitneyResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data?: Array<{ id: string; type: string }> }>;
}

export interface WhitneyListResponse {
  data: WhitneyResource[];
  meta?: { total?: number };
  links?: {
    prev?: string | null;
    next?: string | null;
    first?: string | null;
    last?: string | null;
  };
}

export interface WhitneySingleResponse {
  data: WhitneyResource;
}

/** An image attached to an artwork record. */
export interface WhitneyImage {
  id?: number;
  url?: string;
}

/** Output format shared by every tool. */
export type ResponseFormat = "markdown" | "json";

/** A flattened, context-friendly record ready for rendering. */
export type SummaryRecord = Record<string, unknown>;
