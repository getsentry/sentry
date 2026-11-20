import { describe, expect, test } from "vitest";
import { createSentryClient } from "@sentry/api";

const urlFor = (baseUrl: string | undefined) =>
  createSentryClient(baseUrl === undefined ? {} : { baseUrl })
    .client.buildUrl({ url: "/organizations/" });

describe("the API base path after the base URL", () => {
  test.each([
    ["no trailing slash", "https://sentry.io"],
    ["a trailing slash", "https://sentry.io/"],
    ["several trailing slashes", "https://sentry.io///"],
  ])("follows a base URL with %s once", (_, baseUrl) => {
    expect(urlFor(baseUrl)).toBe("https://sentry.io/api/0/organizations/");
  });

  test("keeps a self-hosted path prefix", () => {
    expect(urlFor("https://example.test/sentry/")).toBe("https://example.test/sentry/api/0/organizations/");
  });

  test("starts the URL when no base URL is set", () => {
    expect(urlFor(undefined)).toBe("/api/0/organizations/");
  });

  test("applies to a per-request base URL too", () => {
    const sentry = createSentryClient({ baseUrl: "https://sentry.io" });
    expect(sentry.client.buildUrl({ baseUrl: "https://us.sentry.io//", url: "/organizations/" }))
      .toBe("https://us.sentry.io/api/0/organizations/");
  });
});
