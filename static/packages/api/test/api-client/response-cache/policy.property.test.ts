/**
 * Property-Based Tests for Response Cache
 *
 * Verifies properties of cache key generation, URL normalization,
 * and URL classification that should hold for any valid input.
 */

import {
  array,
  asyncProperty,
  constantFrom,
  assert as fcAssert,
  property,
  string,
  tuple,
} from "fast-check";
import { describe, expect, test } from "vitest";
import { buildCacheKey, normalizeUrl } from "../../../src/api-client/response-cache/keys.ts";
import { classifyUrl } from "../../../src/api-client/response-cache/tiers.ts";

const DEFAULT_NUM_RUNS = 50;

/** Any non-empty identity; scoping across identities is in keys.test.ts. */
const IDENTITY = "test-identity";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate valid HTTP methods */
const methodArb = constantFrom("GET", "POST", "PUT", "DELETE", "PATCH");

/** Generate simple path segments */
const pathSegmentArb = string({ minLength: 1, maxLength: 20 }).filter((s) =>
  /^[a-zA-Z0-9_-]+$/.test(s),
);

/** Generate URL-like strings with paths and query params */
const sentryUrlArb = tuple(
  constantFrom(
    "https://us.sentry.io",
    "https://de.sentry.io",
    "https://sentry.io",
  ),
  array(pathSegmentArb, { minLength: 1, maxLength: 5 }),
  array(
    tuple(
      string({ minLength: 1, maxLength: 10 }).filter((s) =>
        /^[a-zA-Z]+$/.test(s),
      ),
      string({ minLength: 1, maxLength: 20 }).filter((s) =>
        /^[a-zA-Z0-9]+$/.test(s),
      ),
    ),
    { minLength: 0, maxLength: 4 },
  ),
).map(([base, paths, params]) => {
  const pathStr = `/api/0/${paths.join("/")}`;
  const query =
    params.length > 0
      ? `?${params.map(([k, v]) => `${k}=${v}`).join("&")}`
      : "";
  return `${base}${pathStr}${query}`;
});

// ---------------------------------------------------------------------------
// Tests: buildCacheKey
// ---------------------------------------------------------------------------

describe("property: buildCacheKey", () => {
  test("produces a 64-char hex string (SHA-256)", async () => {
    await fcAssert(
      asyncProperty(methodArb, sentryUrlArb, async (method, url) => {
        expect(await buildCacheKey(method, url, IDENTITY)).toMatch(
          /^[0-9a-f]{64}$/,
        );
      }),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });

  test("is deterministic — same inputs produce same key", async () => {
    await fcAssert(
      asyncProperty(methodArb, sentryUrlArb, async (method, url) => {
        expect(await buildCacheKey(method, url, IDENTITY)).toBe(
          await buildCacheKey(method, url, IDENTITY),
        );
      }),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });

  test("different methods produce different keys for same URL", async () => {
    await fcAssert(
      asyncProperty(sentryUrlArb, async (url) => {
        expect(await buildCacheKey("GET", url, IDENTITY)).not.toBe(
          await buildCacheKey("POST", url, IDENTITY),
        );
      }),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });

  test("query param order does not affect the key", async () => {
    await fcAssert(
      asyncProperty(
        constantFrom("https://us.sentry.io", "https://de.sentry.io"),
        pathSegmentArb,
        async (base, path) => {
          const url1 = `${base}/api/0/${path}?a=1&b=2&c=3`;
          const url2 = `${base}/api/0/${path}?c=3&a=1&b=2`;
          expect(await buildCacheKey("GET", url1, IDENTITY)).toBe(
            await buildCacheKey("GET", url2, IDENTITY),
          );
        },
      ),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });

  test("method comparison is case-insensitive", async () => {
    await fcAssert(
      asyncProperty(sentryUrlArb, async (url) => {
        expect(await buildCacheKey("get", url, IDENTITY)).toBe(
          await buildCacheKey("GET", url, IDENTITY),
        );
      }),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: normalizeUrl
// ---------------------------------------------------------------------------

describe("property: normalizeUrl", () => {
  test("sorts query parameters alphabetically", () => {
    const normalized = normalizeUrl("GET", "https://sentry.io/api?z=1&a=2&m=3");
    expect(normalized).toBe("GET|https://sentry.io/api?a=2&m=3&z=1");
  });

  test("uppercases the method", () => {
    fcAssert(
      property(
        constantFrom("get", "post", "put", "delete"),
        sentryUrlArb,
        (method, url) => {
          const normalized = normalizeUrl(method, url);
          expect(normalized.startsWith(method.toUpperCase())).toBe(true);
        },
      ),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });

  test("produces pipe-separated method|url format", () => {
    fcAssert(
      property(methodArb, sentryUrlArb, (method, url) => {
        const normalized = normalizeUrl(method, url);
        expect(normalized).toContain("|");
        const [m] = normalized.split("|", 1);
        expect(m).toBe(method.toUpperCase());
      }),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: classifyUrl
// ---------------------------------------------------------------------------

describe("property: classifyUrl", () => {
  test("always returns a valid tier", () => {
    fcAssert(
      property(sentryUrlArb, (url) => {
        const tier = classifyUrl(url);
        expect(["stable", "volatile", "no-cache"]).toContain(tier);
      }),
      { numRuns: DEFAULT_NUM_RUNS },
    );
  });

  test("organization event and trace-item details are stable", () => {
    const urls = [
      "https://us.sentry.io/api/0/organizations/myorg/events/myproject:abc123/",
      "https://sentry.io/api/0/organizations/org/events/42:deadbeef/?field=title",
      "https://us.sentry.io/api/0/projects/org/proj/trace-items/a1b2c3d4e5f67890/?trace_id=abc&item_type=spans",
    ];
    for (const url of urls) {
      expect(classifyUrl(url)).toBe("stable");
    }
  });

  test("project event details are volatile", () => {
    const urls = [
      "https://us.sentry.io/api/0/projects/myorg/myproject/events/abc123/",
      "https://sentry.io/api/0/projects/org/proj/events/deadbeef/?full=true",
    ];
    for (const url of urls) {
      expect(classifyUrl(url)).toBe("volatile");
    }
  });

  test("issue events are volatile, including latest/oldest/recommended", () => {
    for (const eventId of ["latest", "oldest", "recommended", "deadbeef"]) {
      const url = `https://us.sentry.io/api/0/organizations/org/issues/123/events/${eventId}/`;
      expect(classifyUrl(url)).toBe("volatile");
    }
  });

  test("full trace URLs with 32-char hex IDs are volatile", () => {
    const traceId = "a".repeat(32);
    const url = `https://us.sentry.io/api/0/organizations/myorg/trace/${traceId}/?limit=100`;
    expect(classifyUrl(url)).toBe("volatile");
  });

  test("issue URLs are volatile (lists and detail views)", () => {
    const urls = [
      "https://us.sentry.io/api/0/projects/org/proj/issues/",
      "https://us.sentry.io/api/0/projects/org/proj/issues/?query=is:unresolved",
      "https://us.sentry.io/api/0/issues/12345/",
      "https://sentry.io/api/0/issues/67890/?format=json",
      "https://us.sentry.io/api/0/organizations/org/issues/12345/hashes/",
    ];
    for (const url of urls) {
      expect(classifyUrl(url)).toBe("volatile");
    }
  });

  test("dataset=logs URLs are volatile", () => {
    const url =
      "https://us.sentry.io/api/0/organizations/org/events/?dataset=logs&query=foo";
    expect(classifyUrl(url)).toBe("volatile");
  });

  test("dataset=spans URLs are volatile", () => {
    const url =
      "https://us.sentry.io/api/0/organizations/org/events/?dataset=spans";
    expect(classifyUrl(url)).toBe("volatile");
  });

  test("autofix URLs are no-cache", () => {
    const urls = [
      "https://us.sentry.io/api/0/organizations/org/issues/123/autofix/",
      "https://sentry.io/api/0/organizations/org/issues/456/autofix/?format=json",
    ];
    for (const url of urls) {
      expect(classifyUrl(url)).toBe("no-cache");
    }
  });

  test("root-cause URLs are no-cache", () => {
    const url =
      "https://us.sentry.io/api/0/organizations/org/issues/123/root-cause/";
    expect(classifyUrl(url)).toBe("no-cache");
  });

  test("org/project/team list URLs default to stable", () => {
    const urls = [
      "https://us.sentry.io/api/0/organizations/",
      "https://us.sentry.io/api/0/organizations/myorg/projects/",
      "https://us.sentry.io/api/0/organizations/myorg/teams/",
    ];
    for (const url of urls) {
      expect(classifyUrl(url)).toBe("stable");
    }
  });
});
