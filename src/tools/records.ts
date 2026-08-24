import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQuery, getList, getOne, type RansackFilters } from "../services/client.js";
import {
  buildResponse,
  paginate,
  renderList,
  renderRecord,
  summariseGeneric,
} from "../services/format.js";
import {
  guard,
  limitField,
  listOutputShape,
  pageField,
  readOnlyAnnotations,
  recordOutputShape,
  responseFormatField,
} from "./shared.js";

const ENDPOINTS = ["artists", "artworks", "exhibitions", "events", "guides", "pages"] as const;

const rawFiltersField = z
  .record(z.string())
  .optional()
  .describe(
    "Raw Ransack predicates, e.g. { \"title_cont\": \"moon\", \"classification_eq\": \"Paintings\" }. " +
      "Matchers: _eq, _not_eq, _cont, _not_cont, _cont_all_split, _true, _false, _gt, _gteq, _lt, _lteq.",
  );

const listShape = {
  title: z.string().optional().describe("Words appearing in the title"),
  filters: rawFiltersField,
  sort: z
    .string()
    .optional()
    .describe("Ransack sort string, e.g. 'start_time desc', 'title asc', or 'random'"),
  page: pageField,
  limit: limitField,
  response_format: responseFormatField,
};

/** Exhibitions and events carry start_time / end_time; guides and pages do not. */
const datedListShape = {
  ...listShape,
  starts_on_or_after: z
    .string()
    .optional()
    .describe("ISO date (YYYY-MM-DD); keep records starting on or after this date"),
  starts_on_or_before: z
    .string()
    .optional()
    .describe("ISO date (YYYY-MM-DD); keep records starting on or before this date"),
};

const idShape = {
  id: z.string().min(1).describe("Record ID"),
  response_format: responseFormatField,
};

const TITLE_KEYS = ["title", "name", "display_title", "headline"];

/** Shared handler for the loosely-typed record endpoints. */
async function listGeneric(
  endpoint: string,
  heading: string,
  args: {
    title?: string;
    filters?: Record<string, string>;
    sort?: string;
    starts_on_or_after?: string;
    starts_on_or_before?: string;
    page: number;
    limit: number;
    response_format: "markdown" | "json";
  },
) {
  const filters: RansackFilters = {
    title_cont: args.title,
    start_time_gteq: args.starts_on_or_after,
    start_time_lteq: args.starts_on_or_before,
    ...(args.filters ?? {}),
  };
  const query = buildQuery(filters, { sort: args.sort, page: args.page });

  const response = await getList(`/${endpoint}`, query);
  const result = paginate(response, args.page, args.limit, (resource) => summariseGeneric(resource));
  const markdown = renderList(
    `# ${heading} — ${result.total} record(s), page ${result.page}`,
    result.results,
    TITLE_KEYS,
  );

  return buildResponse(result as unknown as Record<string, unknown>, markdown, args.response_format);
}

export function registerRecordTools(server: McpServer): void {
  server.registerTool(
    "whitney_search_exhibitions",
    {
      title: "Search Whitney exhibitions",
      description: `Search exhibitions mounted by the Whitney, going back to 1931. Records are fuller for recent decades and sparse for the Museum's early history.

Args:
  - title (string, optional): substring match
  - filters (object, optional): raw Ransack predicates for fields this tool does not expose
  - sort (string, optional): e.g. 'start_time desc', 'random'
  - starts_on_or_after / starts_on_or_before (string, optional): ISO dates (YYYY-MM-DD) filtering on start_time
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { total, count, page, has_more, next_page?, results[] }

Exhibition fields are passed through generically — the Museum documents its field set as subject to change, so this tool keeps whatever scalar fields the API returns, strips HTML, shortens timestamps to dates and drops internal IDs. Known fields include title, start_time, end_time, date_override, url, primary_text, press_highlights and popularity. Run one search with limit=1 to confirm before writing a 'filters' query.`,
      inputSchema: datedListShape,
      outputSchema: listOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) => guard(() => listGeneric("exhibitions", "Whitney exhibitions", args)),
  );

  server.registerTool(
    "whitney_get_exhibition",
    {
      title: "Get a Whitney exhibition",
      description: `Fetch one exhibition record by ID.

Args:
  - id (string): exhibition ID, as returned by whitney_search_exhibitions
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { record: {...} } — fields as published by the API, HTML stripped.`,
      inputSchema: idShape,
      outputSchema: recordOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        const response = await getOne(`/exhibitions/${encodeURIComponent(args.id)}`);
        const record = summariseGeneric(response.data, 2_000);
        const markdown = renderRecord(`# Exhibition ${args.id}`, record);
        return buildResponse({ record }, markdown, args.response_format);
      }),
  );

  server.registerTool(
    "whitney_search_events",
    {
      title: "Search Whitney events",
      description: `Search Museum events — talks, tours, public programmes and so on — going back to 2008. This list is largely comprehensive.

Args:
  - title (string, optional): substring match
  - filters (object, optional): raw Ransack predicates
  - sort (string, optional): e.g. 'start_time desc'
  - starts_on_or_after / starts_on_or_before (string, optional): ISO dates (YYYY-MM-DD) filtering on start_time
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { total, count, page, has_more, next_page?, results[] }

As with exhibitions, fields are passed through generically. Sort by 'start_time desc' for the most recent programming.`,
      inputSchema: datedListShape,
      outputSchema: listOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) => guard(() => listGeneric("events", "Whitney events", args)),
  );

  server.registerTool(
    "whitney_search_guides",
    {
      title: "Search Whitney audio guides",
      description: `Search audio guides published since 2009. Fetching an individual guide also returns its stops.

Args:
  - title (string, optional), filters (object, optional), sort (string, optional)
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { total, count, page, has_more, next_page?, results[] }`,
      inputSchema: listShape,
      outputSchema: listOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) => guard(() => listGeneric("guides", "Whitney audio guides", args)),
  );

  server.registerTool(
    "whitney_query",
    {
      title: "Raw Whitney API query",
      description: `Escape hatch for queries the typed tools do not cover. Hits any endpoint with arbitrary Ransack predicates.

Args:
  - endpoint ('artists' | 'artworks' | 'exhibitions' | 'events' | 'guides' | 'pages')
  - id (string, optional): fetch a single record instead of a list
  - filters (object, optional): raw predicates, e.g. { "medium_cont_all_split": "graphite paper" }
  - sort (string, optional): e.g. 'popularity desc'
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: a list result, or { record: {...} } when 'id' is supplied.

Prefer the typed tools where they fit — they return tidier records. Use this to discover field names, combine unusual predicates, or reach the 'pages' endpoint. Note that 'pages' mirrors the Museum's CMS structure and is rarely useful outside it.`,
      inputSchema: {
        endpoint: z.enum(ENDPOINTS).describe("Which API endpoint to query"),
        id: z.string().optional().describe("Fetch one record by ID instead of listing"),
        filters: rawFiltersField,
        sort: z.string().optional().describe("Ransack sort string"),
        page: pageField,
        limit: limitField,
        response_format: responseFormatField,
      },
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        if (args.id) {
          const response = await getOne(`/${args.endpoint}/${encodeURIComponent(args.id)}`);
          const record = summariseGeneric(response.data, 2_000);
          const markdown = renderRecord(`# ${args.endpoint} ${args.id}`, record);
          return buildResponse({ record }, markdown, args.response_format);
        }

        return listGeneric(args.endpoint, `Whitney ${args.endpoint}`, {
          filters: args.filters,
          sort: args.sort,
          page: args.page,
          limit: args.limit,
          response_format: args.response_format,
        });
      }),
  );
}
