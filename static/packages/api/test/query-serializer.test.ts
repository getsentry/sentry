import { describe, expect, test } from "vitest";
import { createSentryClient, getOrganizationIssueEvent } from "../src/index";

const sentry = createSentryClient({ baseUrl: "https://sentry.example.com" });

const search = (query: Record<string, unknown>) => {
  const url = sentry.client.buildUrl({ url: "/organizations/", query });
  return url.slice(url.indexOf("?"));
};

// The default matches query-string@7's `stringify`, plus `deepObject` objects.
const cases: [string, Record<string, unknown>, string][] = [
  ["sorted keys", { statsPeriod: "14d", project: "1", environment: "prod" }, "?environment=prod&project=1&statsPeriod=14d"],
  ["null and undefined", { query: null, cursor: undefined, sort: "date" }, "?query&sort=date"],
  ["an empty string", { query: "" }, "?query="],
  ["arrays", { field: ["title", "id"], project: [] }, "?field=title&field=id"],
  ["null and undefined in arrays", { field: ["id", null, undefined] }, "?field=id&field"],
  ["objects", { filter: { status: "open" } }, "?filter[status]=open"],
  ["object keys", { filter: { z: "1", a: null, b: undefined } }, "?filter[a]&filter[z]=1"],
  ["numbers and booleans", { per_page: 25, expand: true }, "?expand=true&per_page=25"],
  ["dates", { start: new Date("2026-01-01T00:00:00Z") }, "?start=2026-01-01T00%3A00%3A00.000Z"],
  ["reserved characters", { query: "is:unresolved !(a*b)'" }, "?query=is%3Aunresolved%20%21%28a%2Ab%29%27"],
];

describe("the default query serializer", () => {
  test.each(cases)("%s", (_, query, expected) => {
    expect(search(query)).toBe(expected);
  });

  test("drops a bare empty key", () => {
    expect(search({ "": null, a: "1" })).toBe("?a=1");
  });

  test("sorts by UTF-16 code unit", () => {
    expect(search({ b: 1, B: 2, a: 3, "10": 4, "2": 5 })).toBe("?10=4&2=5&B=2&a=3&b=1");
  });

  test("rejects nested arrays and objects", () => {
    expect(() => search({ filter: { status: ["open"] } })).toThrow("Nested arrays and objects");
    expect(() => search({ field: [["id"]] })).toThrow("Nested arrays and objects");
  });

  test("serializes generated operations on the default client", async () => {
    let url = "";
    await getOrganizationIssueEvent({
      baseUrl: "https://sentry.example.com",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        url = new Request(input, init).url;
        return Response.json({});
      },
      path: { organization_id_or_slug: "acme", issue_id: "1", event_id: "latest" },
      query: { environment: ["prod"], collapse: [] },
    });
    expect(new URL(url).search).toBe("?environment=prod");
  });

  test("gives way to a custom querySerializer", () => {
    const custom = createSentryClient({ baseUrl: "https://sentry.example.com", querySerializer: () => "custom=1" });
    expect(custom.client.buildUrl({ url: "/organizations/", query: { a: "1" } })).toBe(
      "https://sentry.example.com/api/0/organizations/?custom=1",
    );
  });
});
