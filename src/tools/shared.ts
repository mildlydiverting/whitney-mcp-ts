import { z } from "zod";
import { WhitneyApiError } from "../services/client.js";
import { API_PAGE_SIZE } from "../constants.js";

/** Input fields every tool accepts. */
export const responseFormatField = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: 'markdown' for reading, 'json' for machine processing");

export const pageField = z
  .number()
  .int()
  .min(1)
  .default(1)
  .describe("1-based page number; the API returns 30 records per page");

export const limitField = z
  .number()
  .int()
  .min(1)
  .max(API_PAGE_SIZE)
  .default(10)
  .describe(
    `Maximum records to return from the fetched page (1-${API_PAGE_SIZE}). Keep this low unless you need the detail — Whitney records are verbose.`,
  );

/** Output schema shared by every list tool. */
export const listOutputShape = {
  total: z.number().describe("Total matching records across all pages"),
  count: z.number().describe("Records returned in this response"),
  page: z.number().describe("Page that was fetched"),
  has_more: z.boolean().describe("Whether further pages exist"),
  next_page: z.number().optional().describe("Page number to request next"),
  results: z.array(z.record(z.unknown())).describe("The records"),
  note: z.string().optional().describe("Advisory note about trimming or pagination"),
};

/** Output schema shared by every single-record tool. */
export const recordOutputShape = {
  record: z.record(z.unknown()).describe("The full record"),
};

export const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Run a tool handler, converting thrown errors into an error result the model
 * can act on rather than an unhandled rejection.
 */
export async function guard(handler: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await handler();
  } catch (error) {
    const message =
      error instanceof WhitneyApiError
        ? error.message
        : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
}
