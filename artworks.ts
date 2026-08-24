import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { COMMON_CLASSIFICATIONS } from "../constants.js";
import { buildQuery, getList, getOne, resolveSort, type RansackFilters } from "../services/client.js";
import {
  buildResponse,
  detailArtwork,
  paginate,
  renderList,
  renderRecord,
  summariseArtwork,
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

const ARTWORK_SORTS: Record<string, string> = {
  title_asc: "title asc",
  title_desc: "title desc",
  most_viewed: "popularity desc",
  random: "random",
};

const searchArtworksShape = {
  title: z.string().optional().describe("Words appearing in the title (substring match)"),
  artist: z.string().optional().describe("Words appearing in the artist credit line, e.g. 'Divola'"),
  classification: z
    .string()
    .optional()
    .describe(
      `Exact classification; casing matters. Common values: ${COMMON_CLASSIFICATIONS.join(", ")}`,
    ),
  medium: z.string().optional().describe("Words appearing in the medium, e.g. 'watercolour', 'lithograph'"),
  date: z
    .string()
    .optional()
    .describe("Words in the display date, e.g. '1977'. This is a free-text field, not a number, so ranges are unreliable"),
  department: z
    .enum(["collection", "artport", "special"])
    .optional()
    .describe("Which collection the work belongs to"),
  on_view: z.boolean().optional().describe("Restrict to works currently on view"),
  sort: z
    .enum(["default", "title_asc", "title_desc", "most_viewed", "random"])
    .default("default")
    .describe("Result ordering; 'most_viewed' ranks by views over the last 30 days"),
  page: pageField,
  limit: limitField,
  response_format: responseFormatField,
};

const artworkIdShape = {
  id: z.string().min(1).describe("Artwork ID (the TMS ID, e.g. '38804')"),
  response_format: responseFormatField,
};

export function registerArtworkTools(server: McpServer): void {
  server.registerTool(
    "whitney_search_artworks",
    {
      title: "Search Whitney artworks",
      description: `Search the Whitney Museum's online collection of 27,000+ works.

Returns slim records (id, title, artist, date, medium, classification, on view, first image URL). Call whitney_get_artwork for the full record including dimensions, credit line, description and all images.

Args:
  - title, artist, medium, date (string, optional): substring matches
  - classification (string, optional): exact match, e.g. "Drawings"
  - department ('collection' | 'artport' | 'special', optional)
  - on_view (boolean, optional)
  - sort ('default' | 'title_asc' | 'title_desc' | 'most_viewed' | 'random')
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { total, count, page, has_more, next_page?, results[], note? }

Examples:
  - "watercolours with flowers in the title" -> title="flower", classification="Drawings", medium="watercolor"
  - "show me something at random from the collection" -> sort="random", limit=3

Notes:
  - Medium spellings follow US usage ("watercolor", "color").
  - Date is free text ("1915-1931, printed 1976-1977"), so filter loosely and check results.`,
      inputSchema: searchArtworksShape,
      outputSchema: listOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        const filters: RansackFilters = {
          title_cont: args.title,
          display_artist_text_cont: args.artist,
          classification_eq: args.classification,
          medium_cont: args.medium,
          display_date_cont: args.date,
          department_eq: args.department,
        };
        if (args.on_view === true) filters.on_view_true = 1;
        if (args.on_view === false) filters.on_view_false = 1;

        const query = buildQuery(filters, {
          sort: resolveSort(args.sort, ARTWORK_SORTS),
          page: args.page,
        });

        const response = await getList("/artworks", query);
        const result = paginate(response, args.page, args.limit, summariseArtwork);
        const markdown = renderList(
          `# Whitney artworks — ${result.total} match(es), page ${result.page}`,
          result.results,
          ["title"],
        );

        return buildResponse(result as unknown as Record<string, unknown>, markdown, args.response_format);
      }),
  );

  server.registerTool(
    "whitney_get_artwork",
    {
      title: "Get a Whitney artwork",
      description: `Fetch one artwork's full record by ID.

Args:
  - id (string): the artwork's TMS ID, as returned by whitney_search_artworks
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { record: { id, title, artist, artist_ids[], date, medium, dimensions, classification, department, accession_number, credit_line, on_view, description, object_label, visual_description, alt_text, images[], page_url } }

Fields are omitted when empty. Alt text is human-written where available and AI-generated otherwise; alt_text_is_ai_generated flags which.

Errors: returns a 404 message if the ID does not exist.`,
      inputSchema: artworkIdShape,
      outputSchema: recordOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        const response = await getOne(`/artworks/${encodeURIComponent(args.id)}`);
        const record = detailArtwork(response.data);
        const markdown = renderRecord(`# ${String(record.title ?? "Artwork")}`, record);
        return buildResponse({ record }, markdown, args.response_format);
      }),
  );
}
