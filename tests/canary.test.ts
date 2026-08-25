/**
 * Canary tests. These call the real Whitney API and assert that the fields this
 * server depends on still exist. They are skipped unless CANARY=1, so a normal
 * `npm test` stays offline and fast.
 *
 * A failure here usually means one of two things: the Whitney changed something
 * (worth knowing) or their server was having a bad morning (not your bug).
 * Check https://whitney.org/about/website/api before assuming the former.
 */
import { describe, expect, it } from "vitest";
import { buildQuery, getList, getOne } from "../src/services/client.js";

const live = process.env.CANARY === "1";

describe.skipIf(!live)("Whitney API canary", () => {
  it("returns an artist with the authority IDs we rely on", async () => {
    // 962 is Georgia O'Keeffe: long-established, unlikely to be withdrawn.
    const response = await getOne("/artists/962");
    const attributes = response.data.attributes;

    expect(response.data.id).toBe("962");
    expect(attributes.display_name).toBeTypeOf("string");
    expect(attributes.ulan_id).toBeTypeOf("string");
    expect(attributes.wikidata_id).toBeTypeOf("string");
    expect(attributes.biography).toBeTypeOf("string");
  }, 30_000);

  it("still links to other records from inside biographies", async () => {
    const response = await getOne("/artists/962");
    const biography = String(response.data.attributes.biography ?? "");
    // Cross-reference extraction depends on these relative hrefs.
    expect(biography).toMatch(/href="\/(artists|collection\/works)\//);
  }, 30_000);

  it("returns artworks with the fields the summariser maps", async () => {
    const response = await getList("/artworks", buildQuery({ title_cont: "moon" }));
    const first = response.data[0];

    expect(first).toBeDefined();
    expect(response.meta?.total).toBeTypeOf("number");
    expect(first?.attributes).toHaveProperty("display_artist_text");
    expect(first?.attributes).toHaveProperty("classification");
    expect(first?.attributes).toHaveProperty("images");
  }, 30_000);

  it("still accepts Ransack predicates and actually filters", async () => {
    const all = await getList("/artworks");
    const filtered = await getList("/artworks", buildQuery({ classification_eq: "Drawings" }));

    expect(filtered.meta?.total).toBeTypeOf("number");
    expect(filtered.meta!.total!).toBeGreaterThan(0);
    // If Ransack silently stopped filtering, these totals would match.
    expect(filtered.meta!.total!).toBeLessThan(all.meta!.total!);
  }, 30_000);

  it("returns exhibitions with start_time, which the date filters use", async () => {
    const response = await getList("/exhibitions");
    const first = response.data[0];

    expect(first?.attributes).toHaveProperty("start_time");
    expect(String(first?.attributes.start_time)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, 30_000);

  it("filters exhibitions by date range", async () => {
    const query = buildQuery({
      start_time_gteq: "1993-01-01",
      start_time_lteq: "1993-12-31",
    });
    const response = await getList("/exhibitions", query);

    expect(response.meta!.total!).toBeGreaterThan(0);
    // A year of Whitney programming, not the whole archive.
    expect(response.meta!.total!).toBeLessThan(100);
  }, 30_000);

  it("returns events and guides at all", async () => {
    const events = await getList("/events");
    const guides = await getList("/guides");

    expect(events.data.length).toBeGreaterThan(0);
    expect(guides.data.length).toBeGreaterThan(0);
  }, 30_000);
});
