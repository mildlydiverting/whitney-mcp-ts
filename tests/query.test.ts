import { describe, expect, it } from "vitest";
import { buildQuery, resolveSort } from "../src/services/client.js";

describe("buildQuery", () => {
  it("nests filters under q[...]", () => {
    const query = buildQuery({ title_cont: "moon" });
    expect(query.get("q[title_cont]")).toBe("moon");
  });

  it("URL-encodes the brackets", () => {
    expect(buildQuery({ title_cont: "moon" }).toString()).toBe("q%5Btitle_cont%5D=moon");
  });

  it("skips undefined and empty values", () => {
    const query = buildQuery({ title_cont: undefined, medium_cont: "", classification_eq: "Prints" });
    expect(query.has("q[title_cont]")).toBe(false);
    expect(query.has("q[medium_cont]")).toBe(false);
    expect(query.get("q[classification_eq]")).toBe("Prints");
  });

  it("stringifies booleans and numbers", () => {
    const query = buildQuery({ on_view_true: 1, is_portfolio_false: true });
    expect(query.get("q[on_view_true]")).toBe("1");
    expect(query.get("q[is_portfolio_false]")).toBe("true");
  });

  it("puts sort under q[s]", () => {
    expect(buildQuery({}, { sort: "title desc" }).get("q[s]")).toBe("title desc");
  });

  it("omits page 1, since it is the default", () => {
    expect(buildQuery({}, { page: 1 }).has("page")).toBe(false);
    expect(buildQuery({}, { page: 3 }).get("page")).toBe("3");
  });

  it("produces an empty query when given nothing", () => {
    expect(buildQuery().toString()).toBe("");
  });

  it("handles values needing encoding", () => {
    const query = buildQuery({ display_artist_text_cont: "O'Keeffe & Strand" });
    expect(query.get("q[display_artist_text_cont]")).toBe("O'Keeffe & Strand");
  });
});

describe("resolveSort", () => {
  const map = { title_asc: "title asc", most_viewed: "popularity desc" };

  it("maps a friendly name onto a Ransack sort string", () => {
    expect(resolveSort("most_viewed", map)).toBe("popularity desc");
  });

  it("treats 'default' and undefined as no sort", () => {
    expect(resolveSort("default", map)).toBeUndefined();
    expect(resolveSort(undefined, map)).toBeUndefined();
  });

  it("returns undefined for anything not in the map", () => {
    expect(resolveSort("nonsense", map)).toBeUndefined();
  });
});
