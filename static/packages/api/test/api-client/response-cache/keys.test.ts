import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCacheKey, normalizeUrl } from "../../../src/api-client/response-cache/keys.ts";

const URL_A = "https://us.sentry.io/api/0/organizations/acme/projects/?b=2&a=1";

describe("normalizeUrl", () => {
  it("uppercases the method and sorts query params, keeping the host", () => {
    expect(normalizeUrl("get", URL_A)).toBe(
      "GET|https://us.sentry.io/api/0/organizations/acme/projects/?a=1&b=2",
    );
  });

  it("keeps the order of repeated query params", () => {
    expect(
      normalizeUrl(
        "GET",
        "https://us.sentry.io/api/0/issues/1/events/latest/?collapse=fullRelease&a=1&collapse=adjacentEvents",
      ),
    ).toBe(
      "GET|https://us.sentry.io/api/0/issues/1/events/latest/?a=1&collapse=fullRelease&collapse=adjacentEvents",
    );
  });

  it("keeps self-hosted hosts", () => {
    expect(
      normalizeUrl("GET", "https://sentry.mycompany.internal/api/0/issues/"),
    ).toBe("GET|https://sentry.mycompany.internal/api/0/issues/");
  });

  it("throws on a URL it cannot parse", () => {
    expect(() => normalizeUrl("GET", "not a url")).toThrow(TypeError);
  });
});

describe("buildCacheKey", () => {
  it("gives two identities different keys for the same URL", async () => {
    expect(await buildCacheKey("GET", URL_A, "alice")).not.toBe(
      await buildCacheKey("GET", URL_A, "bob"),
    );
  });

  it("gives the same path on two Sentry hosts different keys", async () => {
    const path = "/api/0/organizations/acme/projects/";
    expect(
      await buildCacheKey("GET", `https://us.sentry.io${path}`, "alice"),
    ).not.toBe(
      await buildCacheKey("GET", `https://sentry.example.com${path}`, "alice"),
    );
  });

  it("matches node:crypto HMAC-SHA256, so existing CLI cache entries still hit", async () => {
    const identity = "oauth:3f2a9c";
    const expected = createHmac("sha256", identity)
      .update(normalizeUrl("GET", URL_A))
      .digest("hex");

    expect(await buildCacheKey("GET", URL_A, identity)).toBe(expected);
  });

  it("refuses an empty identity, which would not scope entries", async () => {
    await expect(buildCacheKey("GET", URL_A, "")).rejects.toThrow(TypeError);
  });
});
