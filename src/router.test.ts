import { describe, expect, it } from "vitest";
import { ROUTES, matchRoute } from "./router";

describe("matchRoute", () => {
  it("keeps every declared route", () => {
    for (const route of ROUTES) expect(matchRoute(route)).toBe(route);
  });

  it("normalizes slashes and case", () => {
    expect(matchRoute("/help/")).toBe("/help");
    expect(matchRoute("//songs//")).toBe("/songs");
    expect(matchRoute("/Repertoire")).toBe("/repertoire");
    expect(matchRoute("")).toBe("/");
  });

  it("falls back to the instrument for unknown paths", () => {
    // The Worker serves index.html for everything, so a typo must not blank the page.
    expect(matchRoute("/repertorio")).toBe("/");
    expect(matchRoute("/help/chords")).toBe("/");
    expect(matchRoute("/../etc")).toBe("/");
  });
});
