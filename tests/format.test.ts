import { describe, expect, it } from "vitest";
import {
  detailArtist,
  detailArtwork,
  extractReferences,
  htmlToMarkdown,
  paginate,
  stripHtml,
  summariseArtwork,
  summariseGeneric,
  truncate,
} from "../src/services/format.js";
import {
  artistOKeeffe,
  artistSparse,
  artworkDivola,
  artworkListResponse,
  artworkUntitled,
  exhibitionBiennial,
  shortListResponse,
} from "./fixtures.js";

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>One</p>\n<p>Two</p>")).toBe("One Two");
  });

  it("turns <br> into a space", () => {
    expect(stripHtml("Sheet: 11 in.<br>Image: 9 in.")).toBe("Sheet: 11 in. Image: 9 in.");
  });

  it("decodes entities", () => {
    expect(stripHtml("Tom &amp; Jerry &quot;quoted&quot;")).toBe('Tom & Jerry "quoted"');
  });

  it("decodes &amp; last, so escaped entities survive", () => {
    // If &amp; were decoded first, this would wrongly become "<em>".
    expect(stripHtml("&amp;lt;em&amp;gt;")).toBe("&lt;em&gt;");
  });

  it("returns undefined for empty or non-string input", () => {
    expect(stripHtml("")).toBeUndefined();
    expect(stripHtml(null)).toBeUndefined();
    expect(stripHtml(42)).toBeUndefined();
    expect(stripHtml("<p></p>")).toBeUndefined();
  });
});

describe("htmlToMarkdown", () => {
  const bio = artistOKeeffe.attributes.biography;

  it("converts links and makes relative hrefs absolute", () => {
    expect(htmlToMarkdown(bio)).toContain("[Alfred Stieglitz’s](https://whitney.org/artists/1292)");
  });

  it("leaves absolute hrefs alone", () => {
    expect(htmlToMarkdown('<a href="https://example.com/x">X</a>')).toBe(
      "[X](https://example.com/x)",
    );
  });

  it("converts emphasis to markdown", () => {
    expect(htmlToMarkdown("<p>See <em>Summer Days</em>.</p>")).toBe("See *Summer Days*.");
  });

  it("keeps the link when a title is nested inside it", () => {
    const result = htmlToMarkdown(bio) ?? "";
    expect(result).toContain("[No. 8 – Special](https://whitney.org/collection/works/1617)");
  });

  it("drops tags it does not understand", () => {
    expect(htmlToMarkdown('<p><span class="gray">Plain</span></p>')).toBe("Plain");
  });
});

describe("extractReferences", () => {
  it("pulls artist and artwork IDs out of hrefs", () => {
    const refs = extractReferences(artistOKeeffe.attributes.biography);
    expect(refs.artists).toEqual(["1292", "3500"]);
    expect(refs.artworks).toEqual(["1617", "7759"]);
  });

  it("deduplicates repeated links", () => {
    const refs = extractReferences('<a href="/artists/5">A</a> <a href="/artists/5">A</a>');
    expect(refs.artists).toEqual(["5"]);
  });

  it("returns an empty object when there is nothing to find", () => {
    expect(extractReferences("<p>No links here.</p>")).toEqual({});
    expect(extractReferences(null)).toEqual({});
  });
});

describe("truncate", () => {
  it("leaves short strings alone", () => {
    expect(truncate("short", 20)).toBe("short");
  });

  it("marks truncated strings", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcde… [truncated]");
  });
});

describe("summariseArtwork", () => {
  it("returns the slim field set", () => {
    expect(summariseArtwork(artworkDivola)).toEqual({
      id: "38804",
      title: "Zuma # 82",
      artist: "John Divola",
      date: "1977",
      medium: "Chromogenic print",
      classification: "Photographs",
      on_view: false,
      image: "https://whitneymedia.org/assets/artwork/38804/2011_50_cropped.jpg",
    });
  });

  it("labels untitled works and omits missing images", () => {
    const summary = summariseArtwork(artworkUntitled);
    expect(summary.title).toBe("[no title]");
    expect(summary).not.toHaveProperty("image");
  });
});

describe("detailArtwork", () => {
  const detail = detailArtwork(artworkDivola);

  it("falls back to AI alt text and flags it", () => {
    expect(detail.alt_text).toBe("Empty room with a red spray-painted line.");
    expect(detail.alt_text_is_ai_generated).toBe(true);
  });

  it("includes related artist IDs and a page URL", () => {
    expect(detail.artist_ids).toEqual(["13000"]);
    expect(detail.page_url).toBe("https://whitney.org/collection/works/38804");
  });

  it("omits empty fields rather than emitting nulls", () => {
    expect(detail).not.toHaveProperty("object_label");
    expect(detail).not.toHaveProperty("visual_description");
  });
});

describe("detailArtist", () => {
  it("keeps authority IDs and surfaces cross-references", () => {
    const detail = detailArtist(artistOKeeffe);
    expect(detail.ulan_id).toBe("500018666");
    expect(detail.wikidata_id).toBe("Q46408");
    expect(detail.mentions_artists).toEqual(["1292", "3500"]);
    expect(detail.mentions_artworks).toEqual(["1617", "7759"]);
  });

  it("copes with a sparse record", () => {
    const detail = detailArtist(artistSparse);
    expect(detail.name).toBe("Unknown artist");
    expect(detail).not.toHaveProperty("biography");
    expect(detail).not.toHaveProperty("ulan_id");
  });
});

describe("summariseGeneric", () => {
  const summary = summariseGeneric(exhibitionBiennial);

  it("shortens timestamps to dates", () => {
    expect(summary.start_time).toBe("2026-03-08");
    expect(summary.end_time).toBe("2026-09-07");
  });

  it("makes relative URLs absolute", () => {
    expect(summary.url).toBe("https://whitney.org/exhibitions/2026-biennial");
  });

  it("drops internal foreign keys", () => {
    expect(summary).not.toHaveProperty("primary_media_id");
    expect(summary).not.toHaveProperty("override_media_id");
    expect(summary).not.toHaveProperty("feature_id");
    expect(summary).not.toHaveProperty("installation_series_id");
    expect(summary).not.toHaveProperty("topgoose_id");
  });

  it("keeps tms_id, which is a real identifier", () => {
    const withTms = summariseGeneric({
      id: "1",
      type: "thing",
      attributes: { tms_id: 4321 },
    });
    expect(withTms.tms_id).toBe(4321);
  });

  it("keeps free-text date overrides as prose", () => {
    expect(summary.date_override).toBe("On Partial view through Oct 12");
  });

  it("drops timestamps that are only bookkeeping", () => {
    expect(summary).not.toHaveProperty("created_at");
    expect(summary).not.toHaveProperty("updated_at");
  });
});

describe("paginate", () => {
  it("reports totals and flags further pages", () => {
    const result = paginate(artworkListResponse, 1, 10, summariseArtwork);
    expect(result.total).toBe(27427);
    expect(result.count).toBe(2);
    expect(result.has_more).toBe(true);
    expect(result.next_page).toBe(2);
  });

  it("trims to the limit and says so", () => {
    const result = paginate(artworkListResponse, 1, 1, summariseArtwork);
    expect(result.count).toBe(1);
    expect(result.note).toMatch(/raise 'limit'/);
  });

  it("does not offer a next page when there is none", () => {
    const result = paginate(shortListResponse, 1, 10, summariseArtwork);
    expect(result.has_more).toBe(false);
    expect(result).not.toHaveProperty("next_page");
  });
});
