import { describe, expect, it } from "vitest";
import {
  normalizeOperationId,
  normalizeSpec,
  parsePath,
  singularize,
} from "../lib/normalize-spec.mjs";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// singularize
// ---------------------------------------------------------------------------

describe("singularize", () => {
  it("removes trailing s for regular plurals", () => {
    expect(singularize("issues")).toBe("issue");
    expect(singularize("dashboards")).toBe("dashboard");
    expect(singularize("teams")).toBe("team");
    expect(singularize("projects")).toBe("project");
    expect(singularize("replays")).toBe("replay");
  });

  it("handles -ies plurals", () => {
    expect(singularize("activities")).toBe("activity");
    expect(singularize("queries")).toBe("query");
    expect(singularize("entries")).toBe("entry");
  });

  it("uses the irregular lookup table", () => {
    expect(singularize("aliases")).toBe("alias");
    expect(singularize("statuses")).toBe("status");
    expect(singularize("checkins")).toBe("checkin");
  });

  it("handles -shes, -ches, -xes, -zes plurals", () => {
    expect(singularize("hashes")).toBe("hash");
    expect(singularize("crashes")).toBe("crash");
    expect(singularize("matches")).toBe("match");
    expect(singularize("boxes")).toBe("box");
    expect(singularize("indexes")).toBe("index");
    expect(singularize("buzzes")).toBe("buzz");
  });

  it("handles -sses plurals (classes → class)", () => {
    expect(singularize("classes")).toBe("class");
    expect(singularize("processes")).toBe("process");
    expect(singularize("addresses")).toBe("address");
  });

  it("correctly singularizes releases (regression: -ses rule must not apply)", () => {
    expect(singularize("releases")).toBe("release");
  });

  it("leaves words ending in -ss, -us, -is, -as untouched", () => {
    expect(singularize("class")).toBe("class");
    expect(singularize("status")).toBe("status");
    expect(singularize("analysis")).toBe("analysis");
    expect(singularize("alias")).toBe("alias");
    expect(singularize("atlas")).toBe("atlas");
  });

  it("leaves already-singular words untouched", () => {
    expect(singularize("event")).toBe("event");
    expect(singularize("monitor")).toBe("monitor");
  });

  it("is idempotent — applying twice produces the same result", () => {
    for (const w of [
      "issues", "teams", "releases", "queries", "activities",
      "aliases", "hashes", "classes", "boxes", "processes",
    ]) {
      expect(singularize(singularize(w))).toBe(singularize(w));
    }
  });

  it("never returns an empty string", () => {
    // Single-char input ending in s would produce "" without the stem guard.
    expect(singularize("s")).toBe("s");
    expect(singularize("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parsePath
// ---------------------------------------------------------------------------

describe("parsePath", () => {
  it("strips the leading and trailing slashes", () => {
    const segs = parsePath("/organizations/");
    expect(segs).toEqual([
      { value: "organizations", singularValue: "organization", isParam: false, followedByParam: false },
    ]);
  });

  it("marks path params correctly", () => {
    const segs = parsePath("/organizations/{org}/issues/{id}/");
    expect(segs.map((s) => s.isParam)).toEqual([false, true, false, true]);
    expect(segs.map((s) => s.followedByParam)).toEqual([true, false, true, false]);
  });

  it("converts kebab-case to camelCase", () => {
    const segs = parsePath("/organizations/{org}/events-timeseries/");
    const values = segs.filter((s) => !s.isParam).map((s) => s.value);
    expect(values).toEqual(["organizations", "eventsTimeseries"]);
  });

  it("handles uppercase letters after a hyphen", () => {
    const segs = parsePath("/foo-Bar/");
    expect(segs[0]?.value).toBe("fooBar");
  });

  it("converts underscores to camelCase (e.g. stats_v2 → statsV2)", () => {
    const segs = parsePath("/organizations/{org}/stats_v2/");
    const statics = segs.filter((s) => !s.isParam);
    expect(statics.at(-1)?.value).toBe("statsV2");
  });

  it("singularValue singularizes the last word of a compound segment", () => {
    const segs = parsePath(
      "/organizations/{org}/release-threshold-statuses/{id}/",
    );
    const statics = segs.filter((s) => !s.isParam);
    // "statuses" (last word) hits IRREGULAR → "status"; full camelCase result:
    expect(statics.at(-1)?.singularValue).toBe("releaseThresholdStatus");
    // value keeps the plural form
    expect(statics.at(-1)?.value).toBe("releaseThresholdStatuses");
  });

  it("handles consecutive separators without crashing", () => {
    // "foo--bar" and "a__b" must not crash on the empty word between separators.
    // Both value and singularValue go through the same split-filter-join path.
    const segs = parsePath("/foo--bar/a__b/");
    expect(segs[0]?.value).toBe("fooBar");
    expect(segs[0]?.singularValue).toBe("fooBar");
    expect(segs[1]?.value).toBe("aB");
  });

  it("drops empty segments from leading slashes", () => {
    const segs = parsePath("/custom/resources/");
    expect(segs.every((s) => s.value.length > 0)).toBe(true);
    expect(segs.map((s) => s.value)).toEqual(["custom", "resources"]);
  });

  it("returns empty array for a path of only params", () => {
    // parsePath itself never throws — normalizeOperationId validates the result
    const segs = parsePath("/{a}/{b}/");
    expect(segs.every((s) => s.isParam)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeOperationId
// ---------------------------------------------------------------------------

describe("normalizeOperationId", () => {
  it("GET collection → list", () => {
    expect(normalizeOperationId("get", "/organizations/")).toBe(
      "listOrganizations",
    );
    expect(
      normalizeOperationId("get", "/organizations/{org}/issues/"),
    ).toBe("listOrganizationIssues");
    expect(
      normalizeOperationId(
        "get",
        "/organizations/{org}/issues/{id}/events/",
      ),
    ).toBe("listOrganizationIssueEvents");
  });

  it("GET detail (ends in param) → get + singularized", () => {
    expect(
      normalizeOperationId("get", "/organizations/{org}/"),
    ).toBe("getOrganization");
    expect(
      normalizeOperationId("get", "/organizations/{org}/issues/{id}/"),
    ).toBe("getOrganizationIssue");
    expect(
      normalizeOperationId(
        "get",
        "/organizations/{org}/dashboards/{id}/",
      ),
    ).toBe("getOrganizationDashboard");
  });

  it("POST → create + singularized last segment", () => {
    expect(
      normalizeOperationId("post", "/organizations/{org}/dashboards/"),
    ).toBe("createOrganizationDashboard");
    expect(
      normalizeOperationId("post", "/organizations/{org}/teams/"),
    ).toBe("createOrganizationTeam");
  });

  it("PUT/PATCH → update", () => {
    expect(
      normalizeOperationId("put", "/organizations/{org}/dashboards/{id}/"),
    ).toBe("updateOrganizationDashboard");
    expect(
      normalizeOperationId("patch", "/organizations/{org}/issues/{id}/"),
    ).toBe("updateOrganizationIssue");
  });

  it("DELETE detail → singular", () => {
    expect(
      normalizeOperationId(
        "delete",
        "/organizations/{org}/dashboards/{id}/",
      ),
    ).toBe("deleteOrganizationDashboard");
  });

  it("DELETE collection (bulk) → plural", () => {
    expect(
      normalizeOperationId("delete", "/organizations/{org}/detectors/"),
    ).toBe("deleteOrganizationDetectors");
  });

  it("converts kebab-case path segments to camelCase", () => {
    expect(
      normalizeOperationId(
        "get",
        "/organizations/{org}/events-timeseries/",
      ),
    ).toBe("listOrganizationEventsTimeseries");
    expect(
      normalizeOperationId(
        "get",
        "/organizations/{org}/release-threshold-statuses/",
      ),
    ).toBe("listOrganizationReleaseThresholdStatuses");
  });

  it("handles uppercase letters after a hyphen", () => {
    expect(normalizeOperationId("get", "/foo-Bar/")).toBe("listFooBar");
  });

  it("converts underscores in path segments to camelCase", () => {
    expect(normalizeOperationId("get", "/organizations/{org}/stats_v2/")).toBe(
      "listOrganizationStatsV2",
    );
    expect(normalizeOperationId("get", "/organizations/{org}/relay_usage/")).toBe(
      "listOrganizationRelayUsage",
    );
  });

  it("singularizes compound segments via last-word rule (regression)", () => {
    // GET detail — last word "statuses" hits IRREGULAR → "status"
    expect(
      normalizeOperationId(
        "get",
        "/organizations/{org}/release-threshold-statuses/{id}/",
      ),
    ).toBe("getOrganizationReleaseThresholdStatus"); // not "...Statuse"

    // POST to collection — last word "issues" → "issue"
    expect(
      normalizeOperationId(
        "post",
        "/organizations/{org}/external-issues/",
      ),
    ).toBe("createOrganizationExternalIssue");
  });

  it("handles multi-level nesting", () => {
    expect(
      normalizeOperationId(
        "get",
        "/projects/{org}/{project}/keys/",
      ),
    ).toBe("listProjectKeys");
    expect(
      normalizeOperationId(
        "get",
        "/projects/{org}/{project}/keys/{id}/",
      ),
    ).toBe("getProjectKey");
  });

  it("singularizes parent segments that precede a path param", () => {
    expect(
      normalizeOperationId("get", "/organizations/{org}/issues/"),
    ).toBe("listOrganizationIssues");
    expect(
      normalizeOperationId(
        "get",
        "/organizations/{org}/issues/{id}/events/",
      ),
    ).toBe("listOrganizationIssueEvents");
  });

  it("handles consecutive params (/projects/{org}/{project}/)", () => {
    expect(
      normalizeOperationId("get", "/projects/{org}/{project}/"),
    ).toBe("getProject");
  });

  it("trailing slash presence does not affect the result", () => {
    expect(normalizeOperationId("get", "/organizations")).toBe(
      "listOrganizations",
    );
    expect(normalizeOperationId("get", "/organizations/")).toBe(
      "listOrganizations",
    );
  });

  it("throws when path has no static segments", () => {
    expect(() => normalizeOperationId("get", "/{id}/")).toThrow(
      /no .*usable static segments/,
    );
  });

  it("throws on degenerate all-param path", () => {
    expect(() => normalizeOperationId("get", "/{a}/{b}/")).toThrow(
      /no .*usable static segments/,
    );
  });

  it("throws when the only static segment is separators (empty resource)", () => {
    // splitWords("---") → [] → camelJoin → "", so statics.length is 1 but the
    // assembled resource is empty. The guard must catch this, not crash on
    // resource[0].toUpperCase().
    expect(() => normalizeOperationId("get", "/---/")).toThrow(
      /no .*usable static segments/,
    );
    expect(() => normalizeOperationId("get", "/___/")).toThrow(
      /no .*usable static segments/,
    );
  });

  it("skips interior all-separator segments instead of crashing", () => {
    // An interior segment of pure separators camelCases to "". It must be
    // dropped before assembly, not crash camelJoin on p[0].toUpperCase().
    expect(normalizeOperationId("get", "/organizations/---/issues/")).toBe(
      "listOrganizationsIssues",
    );
    expect(normalizeOperationId("get", "/orgs/___/issues/")).toBe(
      "listOrgsIssues",
    );
  });
});

// ---------------------------------------------------------------------------
// normalizeSpec — collision detection
// ---------------------------------------------------------------------------

describe("normalizeSpec collision detection", () => {
  function writeSpec(paths: Record<string, Record<string, unknown>>) {
    const tmp = join(tmpdir(), `test-spec-${Date.now()}.json`);
    writeFileSync(tmp, JSON.stringify({ paths }));
    return tmp;
  }

  it("throws when two different paths normalize to the same name", () => {
    // /x-y/ and /xY/ both produce "listXY" after kebab→camelCase.
    const input = writeSpec({
      "/x-y/": { get: { operationId: "List X Y" } },
      "/xY/": { get: { operationId: "List XY" } },
    });
    const output = join(tmpdir(), `out-${Date.now()}.json`);
    expect(() => normalizeSpec(input, output)).toThrow(/collision/);
    unlinkSync(input);
    try { unlinkSync(output); } catch {}
  });

  it("throws when a clean identifier collides with a path-derived one", () => {
    // Pre-existing clean IDs must be tracked: if path A has operationId
    // "listOrganizationIssues" (clean) and path B sentence-style normalizes to
    // the same name, that's a collision even though B's ID was a sentence.
    const input = writeSpec({
      "/something/": {
        // Manually set to the same name that the other path would generate.
        get: { operationId: "listOrganizationIssues" },
      },
      "/organizations/{org}/issues/": {
        // Sentence-style → normalizes to "listOrganizationIssues".
        get: { operationId: "List An Organization's Issues" },
      },
    });
    const output = join(tmpdir(), `out-${Date.now()}.json`);
    expect(() => normalizeSpec(input, output)).toThrow(/collision/);
    unlinkSync(input);
    try { unlinkSync(output); } catch {}
  });

  it("does not throw when operationIds are already clean identifiers", () => {
    const input = writeSpec({
      "/organizations/": {
        get: { operationId: "listOrganizations" }, // already clean — skipped
      },
    });
    const output = join(tmpdir(), `out-${Date.now()}.json`);
    expect(() => normalizeSpec(input, output)).not.toThrow();
    unlinkSync(input);
    try { unlinkSync(output); } catch {}
  });

  it("rewrites sentence-style operationIds and leaves clean ones alone", () => {
    const input = writeSpec({
      "/organizations/": {
        get: { operationId: "List Your Organizations" },
        post: { operationId: "createOrganization" }, // already clean
      },
    });
    const output = join(tmpdir(), `out-${Date.now()}.json`);
    normalizeSpec(input, output);
    const result = JSON.parse(readFileSync(output, "utf8"));
    expect(result.paths["/organizations/"].get.operationId).toBe(
      "listOrganizations",
    );
    expect(result.paths["/organizations/"].post.operationId).toBe(
      "createOrganization", // untouched
    );
    unlinkSync(input);
    unlinkSync(output);
  });
});

describe("normalizeSpec int64 formats", () => {
  it("drops int64 only from integers bounded within the safe integer range", () => {
    const schemas = {
      uint32: { type: "integer", format: "int64", minimum: 0, maximum: 4294967295 },
      unbounded: { type: "integer", format: "int64" },
      tooLarge: { type: "integer", format: "int64", minimum: 0, maximum: 9223372036854775807 },
    };
    const input = join(tmpdir(), `test-spec-${Date.now()}.json`);
    writeFileSync(input, JSON.stringify({ paths: {}, components: { schemas } }));
    const output = join(tmpdir(), `out-${Date.now()}.json`);
    normalizeSpec(input, output);
    const result = JSON.parse(readFileSync(output, "utf8")).components.schemas;
    expect(result.uint32).not.toHaveProperty("format");
    expect(result.unbounded.format).toBe("int64");
    expect(result.tooLarge.format).toBe("int64");
    unlinkSync(input);
    unlinkSync(output);
  });

  it("drops every uint64 format", () => {
    const schemas = {
      unbounded: { type: "integer", format: "uint64", minimum: 0 },
      int32: { type: "integer", format: "int32", minimum: 0 },
    };
    const input = join(tmpdir(), `test-spec-${Date.now()}.json`);
    writeFileSync(input, JSON.stringify({ paths: {}, components: { schemas } }));
    const output = join(tmpdir(), `out-${Date.now()}.json`);
    normalizeSpec(input, output);
    const result = JSON.parse(readFileSync(output, "utf8")).components.schemas;
    expect(result.unbounded).toEqual({ type: "integer", minimum: 0 });
    expect(result.int32.format).toBe("int32");
    unlinkSync(input);
    unlinkSync(output);
  });
});

describe("normalizeSpec single-member allOf", () => {
  it("inlines a member wrapped only by annotations, keeping the wrapper's annotations", () => {
    const member = { type: "object", description: "Member description", properties: { id: { type: "string" } } };
    const schemas = {
      annotated: { allOf: [member], description: "Field description", nullable: true },
      constrained: { allOf: [member], description: "Field description", required: ["id"] },
      composed: { allOf: [member, { type: "object" }], description: "Field description" },
    };
    const input = join(tmpdir(), `test-spec-${Date.now()}.json`);
    writeFileSync(input, JSON.stringify({ paths: {}, components: { schemas } }));
    const output = join(tmpdir(), `out-${Date.now()}.json`);
    normalizeSpec(input, output);
    const result = JSON.parse(readFileSync(output, "utf8")).components.schemas;
    expect(result.annotated).toEqual({ ...member, description: "Field description", nullable: true });
    expect(result.constrained).toEqual(schemas.constrained);
    expect(result.composed).toEqual(schemas.composed);
    unlinkSync(input);
    unlinkSync(output);
  });
});
