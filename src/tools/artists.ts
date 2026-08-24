import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQuery, getList, getOne, resolveSort, type RansackFilters } from "../services/client.js";
import {
  buildResponse,
  detailArtist,
  paginate,
  renderList,
  renderRecord,
  summariseArtist,
  summariseArtwork,
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

const ARTIST_SORTS: Record<string, string> = {
  name_asc: "sort_name asc",
  name_desc: "sort_name desc",
  most_viewed: "popularity desc",
  random: "random",
};

const searchArtistsShape = {
  name: z.string().optional().describe("Words appearing in the artist's display name"),
  in_collection: z.boolean().optional().describe("Restrict to artists with work in the collection"),
  in_biennial: z.boolean().optional().describe("Restrict to artists who have shown in a Whitney Biennial"),
  on_view: z.boolean().optional().describe("Restrict to artists with work currently on view"),
  sort: z
    .enum(["default", "name_asc", "name_desc", "most_viewed", "random"])
    .default("default")
    .describe("Result ordering"),
  page: pageField,
  limit: limitField,
  response_format: responseFormatField,
};

const artistIdShape = {
  id: z
    .string()
    .min(1)
    .describe("Artist ID — a TMS ID like '962', or an internal reference prefixed with 'T'"),
  response_format: responseFormatField,
};

const artistRelatedShape = {
  ...artistIdShape,
  page: pageField,
  limit: limitField,
};

export function registerArtistTools(server: McpServer): void {
  server.registerTool(
    "whitney_search_artists",
    {
      title: "Search Whitney artists",
      description: `Search the 7,000+ artists listed by the Whitney — those with work in the collection and those who have appeared in Museum exhibitions.

Returns slim records (id, name, dates, in_collection, in_biennial, on_view). Call whitney_get_artist for the biography and authority IDs.

Args:
  - name (string, optional): substring match on the display name
  - in_collection, in_biennial, on_view (boolean, optional)
  - sort ('default' | 'name_asc' | 'name_desc' | 'most_viewed' | 'random')
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { total, count, page, has_more, next_page?, results[], note? }

Example: "which O'Keeffes are in the collection?" -> search name="O'Keeffe", then whitney_artist_artworks with the returned id.`,
      inputSchema: searchArtistsShape,
      outputSchema: listOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        const filters: RansackFilters = { display_name_cont: args.name };
        if (args.in_collection === true) filters.collection_true = 1;
        if (args.in_biennial === true) filters.biennial_true = 1;
        if (args.on_view === true) filters.on_view_true = 1;

        const query = buildQuery(filters, {
          sort: resolveSort(args.sort, ARTIST_SORTS),
          page: args.page,
        });

        const response = await getList("/artists", query);
        const result = paginate(response, args.page, args.limit, summariseArtist);
        const markdown = renderList(
          `# Whitney artists — ${result.total} match(es), page ${result.page}`,
          result.results,
          ["name"],
        );

        return buildResponse(result as unknown as Record<string, unknown>, markdown, args.response_format);
      }),
  );

  server.registerTool(
    "whitney_get_artist",
    {
      title: "Get a Whitney artist",
      description: `Fetch one artist's full record, including their biography where the Museum has published one.

Args:
  - id (string): TMS ID or 'T'-prefixed reference
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { record: { id, name, sort_name, dates, birth_year, death_year, in_collection, in_biennial, in_artport, on_view, ulan_id, wikidata_id, biography, page_url } }

The biography is stripped of HTML and truncated. ulan_id (Getty ULAN) and wikidata_id are useful for cross-referencing other sources.`,
      inputSchema: artistIdShape,
      outputSchema: recordOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        const response = await getOne(`/artists/${encodeURIComponent(args.id)}`);
        const record = detailArtist(response.data);
        const markdown = renderRecord(`# ${String(record.name ?? "Artist")}`, record);
        return buildResponse({ record }, markdown, args.response_format);
      }),
  );

  server.registerTool(
    "whitney_artist_artworks",
    {
      title: "List an artist's artworks",
      description: `List the collection works by one artist.

Args:
  - id (string): artist ID
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { total, count, page, has_more, next_page?, results[] } with slim artwork records.

Use this rather than whitney_search_artworks with an artist name — it matches on the artist record rather than the credit line, so collaborative and attributed works are handled correctly.`,
      inputSchema: artistRelatedShape,
      outputSchema: listOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        const query = buildQuery({}, { page: args.page });
        const response = await getList(`/artists/${encodeURIComponent(args.id)}/artworks`, query);
        const result = paginate(response, args.page, args.limit, summariseArtwork);
        const markdown = renderList(
          `# Artworks by artist ${args.id} — ${result.total} record(s), page ${result.page}`,
          result.results,
          ["title"],
        );
        return buildResponse(result as unknown as Record<string, unknown>, markdown, args.response_format);
      }),
  );

  server.registerTool(
    "whitney_artist_exhibitions",
    {
      title: "List an artist's exhibitions",
      description: `List Whitney exhibitions featuring one artist.

Args:
  - id (string): artist ID
  - page (number, default 1), limit (number, 1-30, default 10)
  - response_format ('markdown' | 'json', default 'markdown')

Returns: { total, count, page, has_more, next_page?, results[] }.

Exhibition fields are passed through generically (HTML stripped, long prose truncated), because the Museum documents these fields as subject to change. Coverage is fuller for recent decades than for the Museum's early history.`,
      inputSchema: artistRelatedShape,
      outputSchema: listOutputShape,
      annotations: readOnlyAnnotations,
    },
    async (args) =>
      guard(async () => {
        const query = buildQuery({}, { page: args.page });
        const response = await getList(`/artists/${encodeURIComponent(args.id)}/exhibitions`, query);
        const result = paginate(response, args.page, args.limit, (resource) => summariseGeneric(resource));
        const markdown = renderList(
          `# Exhibitions for artist ${args.id} — ${result.total} record(s), page ${result.page}`,
          result.results,
          ["title", "name", "display_title"],
        );
        return buildResponse(result as unknown as Record<string, unknown>, markdown, args.response_format);
      }),
  );
}
