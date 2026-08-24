import { CHARACTER_LIMIT, PROSE_LIMIT } from "../constants.js";
import type {
  ResponseFormat,
  SummaryRecord,
  WhitneyImage,
  WhitneyListResponse,
  WhitneyResource,
} from "../types.js";

/* ------------------------------------------------------------------ *
 * Primitive helpers
 * ------------------------------------------------------------------ */

/** Return a trimmed string, or undefined for empty/non-string values. */
export function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Whitney prose arrives as HTML carrying two things worth keeping: emphasis
 * (which marks work titles) and internal links (which are curator-authored
 * cross-references to other artists and artworks). Both are converted rather
 * than discarded; extractReferences pulls the linked IDs out separately.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/**
 * Convert Whitney HTML to markdown. Links become [text](absolute url),
 * emphasis becomes *text*, everything else is dropped.
 */
export function htmlToMarkdown(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;

  const text = raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    // Links: make relative hrefs absolute, keep the label.
    .replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href: string, label: string) => {
        const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
        const url = href.startsWith("/") ? `https://whitney.org${href}` : href;
        return cleanLabel ? `[${cleanLabel}](${url})` : "";
      },
    )
    // Emphasis: work titles are marked with <em> or <i>.
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_match, _tag, inner: string) => {
      const cleanInner = inner.replace(/<[^>]+>/g, "").trim();
      return cleanInner ? `*${cleanInner}*` : "";
    })
    .replace(/<[^>]+>/g, "");

  const decoded = decodeEntities(text).replace(/\s+/g, " ").trim();
  return decoded.length > 0 ? decoded : undefined;
}

/**
 * Plain-text conversion, for fields where markup carries nothing (dimensions,
 * edition statements, generic passthrough fields).
 */
export function stripHtml(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;

  const text = decodeEntities(
    raw
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0 ? text : undefined;
}

/**
 * Pull Whitney record IDs out of the links in a block of HTML, so a model can
 * follow a cross-reference with whitney_get_artist / whitney_get_artwork rather
 * than matching on names.
 */
export function extractReferences(value: unknown): {
  artists?: string[];
  artworks?: string[];
} {
  const raw = str(value);
  if (!raw) return {};

  const artists = new Set<string>();
  const artworks = new Set<string>();

  for (const match of raw.matchAll(/href=["']\/artists\/([A-Za-z0-9]+)["']/gi)) {
    if (match[1]) artists.add(match[1]);
  }
  for (const match of raw.matchAll(/href=["']\/collection\/works\/([A-Za-z0-9]+)["']/gi)) {
    if (match[1]) artworks.add(match[1]);
  }

  return {
    ...(artists.size > 0 ? { artists: [...artists] } : {}),
    ...(artworks.size > 0 ? { artworks: [...artworks] } : {}),
  };
}

export function truncate(value: string | undefined, max: number = PROSE_LIMIT): string | undefined {
  if (!value) return undefined;
  return value.length <= max ? value : `${value.slice(0, max).trimEnd()}… [truncated]`;
}

/** Drop undefined values so summaries stay compact. */
function compact(record: SummaryRecord): SummaryRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function firstImageUrl(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const first = value[0] as WhitneyImage | undefined;
  return str(first?.url);
}

function allImageUrls(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = (value as WhitneyImage[]).map((image) => str(image?.url)).filter((url): url is string => Boolean(url));
  return urls.length > 0 ? urls : undefined;
}

function relatedIds(resource: WhitneyResource, key: string): string[] | undefined {
  const entries = resource.relationships?.[key]?.data;
  if (!entries || entries.length === 0) return undefined;
  return entries.map((entry) => entry.id);
}

/* ------------------------------------------------------------------ *
 * Record summarisers
 * ------------------------------------------------------------------ */

/** Slim artwork shape for search results. */
export function summariseArtwork(resource: WhitneyResource): SummaryRecord {
  const a = resource.attributes;
  return compact({
    id: resource.id,
    title: str(a.title) ?? "[no title]",
    artist: str(a.display_artist_text),
    date: str(a.display_date),
    medium: str(a.medium),
    classification: str(a.classification),
    on_view: bool(a.on_view),
    image: firstImageUrl(a.images),
  });
}

/** Everything worth having about one artwork. */
export function detailArtwork(resource: WhitneyResource): SummaryRecord {
  const a = resource.attributes;
  const refs = extractReferences(a.description ?? "");
  const labelRefs = extractReferences(a.object_label ?? "");
  const mentionedArtists = [...new Set([...(refs.artists ?? []), ...(labelRefs.artists ?? [])])];
  const mentionedArtworks = [...new Set([...(refs.artworks ?? []), ...(labelRefs.artworks ?? [])])];

  return compact({
    id: resource.id,
    tms_id: num(a.tms_id),
    title: str(a.title) ?? "[no title]",
    artist: str(a.display_artist_text),
    artist_ids: relatedIds(resource, "artists"),
    date: str(a.display_date),
    medium: str(a.medium),
    dimensions: stripHtml(a.dimensions),
    classification: str(a.classification),
    department: str(a.department),
    accession_number: str(a.accession_number),
    credit_line: str(a.credit_line),
    portfolio: str(a.portfolio),
    edition: stripHtml(a.edition),
    publication_info: str(a.publication_info),
    on_view: bool(a.on_view),
    description: truncate(htmlToMarkdown(a.description)),
    object_label: truncate(htmlToMarkdown(a.object_label)),
    visual_description: truncate(stripHtml(a.visual_description)),
    alt_text: str(a.alt_text) ?? str(a.ai_alt_text),
    alt_text_is_ai_generated: str(a.alt_text) ? undefined : Boolean(str(a.ai_alt_text)),
    mentions_artists: mentionedArtists.length > 0 ? mentionedArtists : undefined,
    mentions_artworks: mentionedArtworks.length > 0 ? mentionedArtworks : undefined,
    images: allImageUrls(a.images),
    page_url: `https://whitney.org/collection/works/${resource.id}`,
  });
}

export function summariseArtist(resource: WhitneyResource): SummaryRecord {
  const a = resource.attributes;
  return compact({
    id: resource.id,
    name: str(a.display_name),
    dates: str(a.display_date),
    in_collection: bool(a.collection),
    in_biennial: bool(a.biennial),
    on_view: bool(a.on_view),
  });
}

export function detailArtist(resource: WhitneyResource): SummaryRecord {
  const a = resource.attributes;
  const refs = extractReferences(a.biography ?? "");

  return compact({
    id: resource.id,
    tms_id: num(a.tms_id),
    name: str(a.display_name),
    sort_name: str(a.sort_name),
    dates: str(a.display_date),
    birth_year: str(a.begin_date),
    death_year: str(a.end_date),
    in_collection: bool(a.collection),
    in_biennial: bool(a.biennial),
    in_artport: bool(a.artport),
    on_view: bool(a.on_view),
    ulan_id: str(a.ulan_id),
    wikidata_id: str(a.wikidata_id),
    biography: truncate(htmlToMarkdown(a.biography)),
    mentions_artists: refs.artists,
    mentions_artworks: refs.artworks,
    page_url: `https://whitney.org/artists/${resource.id}`,
  });
}

/**
 * Fallback summariser for record types whose fields are not pinned down here
 * (exhibitions, events, guides, pages). Scalar values are kept, HTML is
 * stripped, long prose is truncated and internal identifiers are dropped.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

/** Internal numeric foreign keys carry no meaning outside the Museum's systems. */
function isInternalId(key: string, value: unknown): boolean {
  return typeof value === "number" && key.endsWith("_id") && key !== "tms_id";
}

export function summariseGeneric(resource: WhitneyResource, proseLimit = 400): SummaryRecord {
  const output: SummaryRecord = { id: resource.id, type: resource.type };
  const skip = new Set(["id", "topgoose_id", "created_at", "updated_at"]);

  for (const [key, value] of Object.entries(resource.attributes)) {
    if (skip.has(key) || isInternalId(key, value)) continue;

    if (typeof value === "boolean" || typeof value === "number") {
      output[key] = value;
      continue;
    }

    if (typeof value === "string") {
      // Timestamps arrive with a time and offset that is never meaningful here.
      if (ISO_TIMESTAMP.test(value)) {
        output[key] = value.slice(0, 10);
        continue;
      }

      const text = stripHtml(value);
      if (!text) continue;

      output[key] =
        key === "url" && text.startsWith("/")
          ? `https://whitney.org${text}`
          : truncate(text, proseLimit);
      continue;
    }

    if (Array.isArray(value) && value.length > 0) {
      const urls = allImageUrls(value);
      if (urls) output[key] = urls;
    }
  }

  return output;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function renderValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** Render a list of summary records as readable markdown. */
export function renderList(heading: string, records: SummaryRecord[], titleKeys: string[]): string {
  if (records.length === 0) return `${heading}\n\nNo matching records.`;

  const lines: string[] = [heading, ""];

  for (const record of records) {
    const titleKey = titleKeys.find((key) => record[key] !== undefined);
    const title = titleKey ? renderValue(record[titleKey]) : "[untitled]";
    lines.push(`### ${title} (id: ${renderValue(record.id)})`);

    for (const [key, value] of Object.entries(record)) {
      if (key === "id" || key === titleKey) continue;
      lines.push(`- **${key.replace(/_/g, " ")}**: ${renderValue(value)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Render one record as markdown. */
export function renderRecord(heading: string, record: SummaryRecord): string {
  const lines: string[] = [heading, ""];
  for (const [key, value] of Object.entries(record)) {
    lines.push(`- **${key.replace(/_/g, " ")}**: ${renderValue(value)}`);
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Pagination and response assembly
 * ------------------------------------------------------------------ */

export interface PagedResult {
  total: number;
  count: number;
  page: number;
  has_more: boolean;
  next_page?: number;
  results: SummaryRecord[];
  note?: string;
}

/**
 * The API returns a fixed page size, so `limit` trims client-side. Totals come
 * from `meta.total` where present.
 */
export function paginate(
  response: WhitneyListResponse,
  page: number,
  limit: number,
  summarise: (resource: WhitneyResource) => SummaryRecord,
): PagedResult {
  const all = response.data ?? [];
  const results = all.slice(0, limit).map(summarise);
  const total = response.meta?.total ?? all.length;
  const hasMore = Boolean(response.links?.next) || total > page * all.length;

  return {
    total,
    count: results.length,
    page,
    has_more: hasMore,
    ...(hasMore ? { next_page: page + 1 } : {}),
    results,
    ...(all.length > results.length
      ? { note: `Showing ${results.length} of ${all.length} records on this page; raise 'limit' to see the rest.` }
      : {}),
  };
}

/**
 * Assemble a tool response, honouring the requested format and the character
 * limit. Structured content is always returned alongside the text.
 */
export function buildResponse(structured: SummaryRecord, markdown: string, format: ResponseFormat) {
  let text = format === "json" ? JSON.stringify(structured, null, 2) : markdown;

  if (text.length > CHARACTER_LIMIT) {
    text = `${text.slice(0, CHARACTER_LIMIT)}\n\n[Response truncated at ${CHARACTER_LIMIT} characters. Narrow your filters or lower 'limit'.]`;
  }

  return {
    content: [{ type: "text" as const, text }],
    structuredContent: structured,
  };
}
