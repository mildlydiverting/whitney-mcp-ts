/**
 * Fixtures trimmed from real Whitney API responses. Kept as TypeScript rather
 * than JSON so each one can carry a note about why it's here.
 */
import type { WhitneyResource } from "../src/types.js";

/** Georgia O'Keeffe: biography with internal links to artists and artworks. */
export const artistOKeeffe: WhitneyResource = {
  id: "962",
  type: "artist",
  attributes: {
    id: 962,
    topgoose_id: 1171,
    tms_id: 962,
    display_name: "Georgia O'Keeffe",
    sort_name: "O'Keeffe Georgia",
    display_date: "1887–1986",
    begin_date: "1887",
    end_date: "1986",
    biography:
      '<p>Her drawings were exhibited at <a href="/artists/1292">Alfred Stieglitz\u2019s</a> pioneering 291 gallery. The spiral form appears in <a href="/collection/works/1617"><em>No. 8 \u2013 Special</em></a>, and later in <a href="/collection/works/7759"><em>Music, Pink and Blue No. 2</em></a>. She worked alongside <a href="/artists/3500">Paul Strand</a> &amp; married Stieglitz.</p>',
    on_view: true,
    artport: false,
    biennial: true,
    collection: true,
    ulan_id: "500018666",
    wikidata_id: "Q46408",
    popularity: 0.96,
    created_at: "2017-08-30T16:11:05.000-04:00",
    updated_at: "2026-08-09T04:38:04.933-04:00",
  },
};

/** An artist with no biography and no authority IDs. */
export const artistSparse: WhitneyResource = {
  id: "T1234",
  type: "artist",
  attributes: {
    id: "T1234",
    display_name: "Unknown artist",
    display_date: "",
    collection: true,
    biennial: false,
    on_view: false,
  },
};

/** Divola photograph: has an image, AI alt text, no human alt text. */
export const artworkDivola: WhitneyResource = {
  id: "38804",
  type: "artwork",
  attributes: {
    id: 38804,
    topgoose_id: 14729,
    tms_id: 38804,
    title: "Zuma # 82",
    display_artist_text: "John Divola",
    display_date: "1977",
    accession_number: "2011.50",
    dimensions: "Sheet: 11 \u00d7 13 15/16 in.<br>Image: 9 3/4 \u00d7 12 in.",
    medium: "Chromogenic print",
    department: "collection",
    classification: "Photographs",
    credit_line: "Purchase, with funds from the Photography Committee",
    description: "<p>John Divola, <em>Zuma # 82</em>, 1977. Chromogenic print.</p>",
    object_label: null,
    ai_alt_text: "Empty room with a red spray-painted line.",
    alt_text: null,
    visual_description: null,
    on_view: false,
    popularity: 0.058,
    images: [
      { id: 110795, url: "https://whitneymedia.org/assets/artwork/38804/2011_50_cropped.jpg" },
    ],
  },
  relationships: { artists: { data: [{ id: "13000", type: "artist" }] } },
};

/** An artwork with no title and no images. */
export const artworkUntitled: WhitneyResource = {
  id: "37091",
  type: "artwork",
  attributes: {
    id: 37091,
    tms_id: 37091,
    title: null,
    display_artist_text: "Paul Strand",
    display_date: "1915\u20131931, printed 1976\u20131977",
    medium: "See individual records.",
    classification: "Photographs",
    on_view: false,
    images: [],
  },
};

/** Biennial 2026: timestamps, relative URL, internal media IDs. */
export const exhibitionBiennial: WhitneyResource = {
  id: "2294",
  type: "exhibition",
  attributes: {
    id: 2294,
    topgoose_id: 9999,
    title: "Whitney Biennial 2026",
    start_time: "2026-03-08T00:00:00.000-05:00",
    end_time: "2026-09-07T00:00:00.000-04:00",
    date_override: "On Partial view through Oct 12",
    url: "/exhibitions/2026-biennial",
    primary_text: "<p>The eighty-second edition of the Whitney Biennial.</p>",
    primary_media_id: 65310,
    override_media_id: 64738,
    feature_id: 112,
    installation_series_id: 2663,
    press_highlights: "Whitney Biennial Names 56 Artists\u2014The New York Times",
    popularity: 1,
    created_at: "2025-01-01T00:00:00.000-05:00",
    updated_at: "2026-08-01T00:00:00.000-04:00",
  },
};

/** A list response wrapping the artwork fixtures. */
export const artworkListResponse = {
  data: [artworkDivola, artworkUntitled],
  meta: { total: 27427 },
  links: { prev: null, next: "https://whitney.org/api/artworks?page=2", first: null, last: null },
};

/** A single-page list response: no next link, small total. */
export const shortListResponse = {
  data: [artworkDivola],
  meta: { total: 1 },
  links: { prev: null, next: null, first: null, last: null },
};
