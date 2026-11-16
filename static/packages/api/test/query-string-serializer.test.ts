import { describe, expect, test } from "vitest";
import { createSentryClient, queryStringSerializer } from "../src/index";

const defaultClient = createSentryClient({ baseUrl: "https://sentry.example.com" });
const queryStringClient = createSentryClient({ baseUrl: "https://sentry.example.com", querySerializer: queryStringSerializer });

const search = (client: typeof defaultClient, query: Record<string, unknown>) => {
  const url = client.client.buildUrl({ url: "/organizations/", query });
  return url.slice(url.indexOf("?"));
};

// The same inputs through both serializers: the default stays as it was, and
// queryStringSerializer gives query-string@7's `stringify` output.
const cases: [string, Record<string, unknown>, string, string][] = [
  ["key order", { statsPeriod: "14d", project: "1", environment: "prod" },
    "?statsPeriod=14d&project=1&environment=prod", "?environment=prod&project=1&statsPeriod=14d"],
  ["null and undefined", { query: null, cursor: undefined, sort: "date" },
    "?sort=date", "?query&sort=date"],
  ["an empty string", { query: "" },
    "?query=", "?query="],
  ["arrays", { field: ["title", "id"], project: [] },
    "?field=title&field=id", "?field=title&field=id"],
  ["null and undefined in arrays", { field: ["id", null, undefined] },
    "?field=id&&", "?field=id&field"],
  ["objects", { filter: { status: "open" } },
    "?filter[status]=open", "?filter=%5Bobject%20Object%5D"],
  ["numbers and booleans", { per_page: 25, expand: true },
    "?per_page=25&expand=true", "?expand=true&per_page=25"],
  ["reserved characters", { query: "is:unresolved !(a*b)'" },
    "?query=is%3Aunresolved%20!(a*b)'", "?query=is%3Aunresolved%20%21%28a%2Ab%29%27"],
];

describe("query serializers", () => {
  test.each(cases)("%s", (_, query, byDefault, byQueryString) => {
    expect(search(defaultClient, query)).toBe(byDefault);
    expect(search(queryStringClient, query)).toBe(byQueryString);
  });

  test("queryStringSerializer drops a bare empty key", () => {
    expect(queryStringSerializer({ "": null, a: "1" })).toBe("a=1");
  });

  test("queryStringSerializer sorts by UTF-16 code unit", () => {
    expect(queryStringSerializer({ b: 1, B: 2, a: 3, "10": 4, "2": 5 })).toBe("10=4&2=5&B=2&a=3&b=1");
  });
});
