import { describe, expect, it } from "vitest";
import { classifyUrl, FALLBACK_TTL_MS, type TtlTier } from "../../../src/api-client/response-cache/tiers.ts";

const API = "https://us.sentry.io/api/0";
const TRACE_ID = "a".repeat(32);

function ttlFor(url: string): number {
  return FALLBACK_TTL_MS[classifyUrl(url)];
}

describe("classifyUrl", () => {
  it("reuses organization event lookups for up to 5 minutes", () => {
    expect(classifyUrl(`${API}/organizations/acme/events/web:deadbeef/`)).toBe(
      "stable",
    );
    expect(ttlFor(`${API}/organizations/acme/events/web:deadbeef/`)).toBe(
      5 * 60 * 1000,
    );
  });

  it("reuses issue event lookups for at most 60 seconds", () => {
    for (const event of ["latest", "oldest", "recommended", "deadbeef"]) {
      const url = `${API}/organizations/acme/issues/123/events/${event}/`;
      expect(classifyUrl(url)).toBe("volatile");
      expect(ttlFor(url)).toBeLessThanOrEqual(60 * 1000);
    }
  });

  it("keeps issue events volatile when adjacent events are collapsed", () => {
    expect(
      classifyUrl(
        `${API}/organizations/acme/issues/123/events/latest/?collapse=adjacentEvents`,
      ),
    ).toBe("volatile");
  });

  it("keeps project events volatile when adjacent events are collapsed", () => {
    expect(
      classifyUrl(
        `${API}/projects/acme/backend/events/deadbeef/?collapse=adjacentEvents`,
      ),
    ).toBe("volatile");
  });

  it("reuses full traces for at most 60 seconds, since spans can still arrive", () => {
    const url = `${API}/organizations/acme/trace/${TRACE_ID}/?limit=100`;
    expect(classifyUrl(url)).toBe("volatile");
    expect(ttlFor(url)).toBeLessThanOrEqual(60 * 1000);
  });

  it("treats trace log queries as volatile", () => {
    expect(
      classifyUrl(`${API}/organizations/acme/trace-logs/?traceId=${TRACE_ID}`),
    ).toBe("volatile");
  });

  it("never serves polling endpoints from cache", () => {
    for (const url of [
      `${API}/organizations/acme/issues/123/autofix/`,
      `${API}/organizations/acme/issues/123/root-cause/`,
    ]) {
      expect(classifyUrl(url)).toBe("no-cache");
      expect(ttlFor(url)).toBe(0);
    }
  });
});

describe("FALLBACK_TTL_MS", () => {
  it("has no tier that reuses a response for more than 5 minutes", () => {
    for (const tier of Object.keys(FALLBACK_TTL_MS) as TtlTier[]) {
      expect(FALLBACK_TTL_MS[tier]).toBeLessThanOrEqual(5 * 60 * 1000);
    }
  });
});
