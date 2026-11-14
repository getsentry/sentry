import { describe, expect, test } from "vitest";
import {
  createIdempotentOperationMatcher,
  selectIdempotentWrites,
} from "../../src/api-client/idempotent-operations.ts";

describe("selectIdempotentWrites", () => {
  test("keeps marked writes and drops safe methods and unmarked writes", () => {
    expect(
      selectIdempotentWrites([
        { method: "GET", path: "/b/", idempotent: true },
        { method: "PUT", path: "/b/", idempotent: true },
        { method: "POST", path: "/b/", idempotent: false },
        { method: "DELETE", path: "/a/", idempotent: true },
      ]),
    ).toEqual([
      { method: "DELETE", path: "/a/" },
      { method: "PUT", path: "/b/" },
    ]);
  });
});

describe("createIdempotentOperationMatcher", () => {
  const isIdempotent = createIdempotentOperationMatcher(() => [
    {
      method: "POST",
      path: "/organizations/{organization_id_or_slug}/chunk-upload/",
    },
  ]);
  const url = "https://us.sentry.io/api/0/organizations/acme/chunk-upload/";

  test("matches a templated path", () => {
    expect(isIdempotent("POST", url)).toBe(true);
  });

  test("ignores method case, a missing trailing slash, and the query", () => {
    expect(isIdempotent("post", url.slice(0, -1))).toBe(true);
    expect(isIdempotent("POST", `${url}?foo=bar`)).toBe(true);
  });

  test("matches under a self-hosted path prefix", () => {
    expect(
      isIdempotent(
        "POST",
        "https://sentry.example.com/sentry/api/0/organizations/acme/chunk-upload/",
      ),
    ).toBe(true);
  });

  test("does not match other methods or extra path segments", () => {
    expect(isIdempotent("PUT", url)).toBe(false);
    expect(
      isIdempotent(
        "POST",
        "https://us.sentry.io/api/0/organizations/acme/extra/chunk-upload/",
      ),
    ).toBe(false);
  });

  test("returns false for URLs it cannot parse or that are not API paths", () => {
    expect(isIdempotent("POST", "not a url")).toBe(false);
    expect(
      isIdempotent("POST", "https://us.sentry.io/organizations/acme/"),
    ).toBe(false);
  });

  test("reads the list once, on first use", () => {
    let loads = 0;
    const matcher = createIdempotentOperationMatcher(() => {
      loads += 1;
      return [];
    });
    expect(loads).toBe(0);
    matcher("POST", url);
    matcher("POST", url);
    expect(loads).toBe(1);
  });
});
