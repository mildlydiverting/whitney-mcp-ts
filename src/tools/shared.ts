import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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

/** Attribution line appended to every response by buildResponse. */
const sourceField = z
  .string()
  .describe("Attribution for the data, as the Whitney's terms ask for");

/** Output schema shared by every list tool. */
export const listOutputShape = {
  total: z.number().describe("Total matching records across all pages"),
  count: z.number().describe("Records returned in this response"),
  page: z.number().describe("Page that was fetched"),
  has_more: z.boolean().describe("Whether further pages exist"),
  next_page: z.number().optional().describe("Page number to request next"),
  results: z.array(z.record(z.unknown())).describe("The records"),
  note: z.string().optional().describe("Advisory note about trimming or pagination"),
  source: sourceField,
};

/** Output schema shared by every single-record tool. */
export const recordOutputShape = {
  record: z.record(z.unknown()).describe("The full record"),
  source: sourceField,
};

export const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/**
 * Use the SDK's own result type rather than a hand-rolled one: registerTool
 * expects a type carrying an index signature, which a local interface does not
 * supply implicitly.
 */
export type ToolResult = CallToolResult;

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
