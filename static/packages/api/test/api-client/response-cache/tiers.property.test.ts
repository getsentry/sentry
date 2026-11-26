/**
 * Property-based tests for URL classification: properties that should hold
 * for any valid input.
 */

import { array, constantFrom, assert as fcAssert, property, string, tuple } from "fast-check";
import { describe, expect, test } from "vitest";
import { classifyUrl } from "../../../src/api-client/response-cache/tiers.ts";

const DEFAULT_NUM_RUNS = 50;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

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
