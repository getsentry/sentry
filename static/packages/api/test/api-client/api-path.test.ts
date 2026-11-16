import { describe, expect, it } from "vitest";
import { UserInputError } from "../../src/api-client/errors.ts";
import {
  apiPath,
  buildSentryApiUrl,
  encodeApiPathSegment,
  parseApiPathScope,
  withQuery,
} from "../../src/api-client/api-path.ts";

/**
 * Resolves a path the way `fetch` does. Dot-segment normalization happens during URL
 * parsing rather than in our code, so a test that only inspected the assembled string
 * would pass even if traversal still worked.
 */
function resolve(path: string): string {
  const url = new URL(`https://sentry.io/api/0${path}`);
  return url.pathname + url.search;
}

describe("apiPath", () => {
  it("leaves legitimate identifier formats byte for byte", () => {
    for (const value of [
      "my-org",
      "my_project.name",
      "1234567890",
      "cfe78a5c892d4a64a962d837673398d2",
      "7e07485f-12f9-416b-8b14-26260799b51f",
      "PROJECT-1Z43",
      "latest",
    ]) {
      expect(apiPath`/projects/${value}/`).toBe(`/projects/${value}/`);
    }
  });

  it("resolves an unencoded payload out of scope, proving these tests are meaningful", () => {
    const attack = "../../../victim-org/victim-proj/events/abc";

    expect(resolve(`/projects/my-org/my-proj/events/${attack}/`)).toBe(
      "/api/0/projects/victim-org/victim-proj/events/abc/",
    );
  });

  /**
   * VULN-2450 asked that any patch be retested against these variants, since
   * encode-only fixes for this class have historically been bypassable.
   *
   * Asserting the whole resolved path is what proves containment. Searching for the
   * payload text would not, since an encoded payload still contains it as literal text.
   */
  it.each([
    ["plain dot segments", "../../other-org"],
    ["double encoded dots", "%252e%252e%252fother-org"],
    ["single encoded dots", "%2e%2e%2fother-org"],
    ["recursive sequences", "....//....//other-org"],
    ["backslash separators", "..\\..\\other-org"],
    ["null byte", "abc\u0000/../other-org"],
    ["fragment truncation", "abc/#"],
    ["query injection", "abc/?download=1&x=2"],
    ["scheme relative", "//evil.example.com/x"],
    ["absolute path", "/organizations/other-org/members"],
    ["trailing dot segment", "abc/.."],
    ["dots with a suffix", "..a"],
  ])("contains %s in a single segment", (_label, attack) => {
    expect(resolve(apiPath`/projects/my-org/my-proj/events/${attack}/`)).toBe(
      `/api/0/projects/my-org/my-proj/events/${encodeURIComponent(attack)}/`,
    );
  });

  /**
   * A bare dot segment carries no separator, so encoding leaves it intact and the URL
   * parser still collapses it. It cannot name another tenant, but it does consume a
   * preceding segment, so it has to be rejected rather than encoded.
   */
  describe("bare dot segments", () => {
    it.each([".", ".."])("rejects %s", (attack) => {
      expect(() => apiPath`/projects/o/p/keys/${attack}/`).toThrow(
        UserInputError,
      );
    });

    it("would otherwise consume the preceding segment", () => {
      expect(resolve("/projects/o/p/keys/../")).toBe("/api/0/projects/o/p/");
      expect(resolve("/projects/o/p/keys/%2e%2e/")).toBe(
        "/api/0/projects/o/p/",
      );
    });

    it("accepts values that merely contain dots, including encoded spellings", () => {
      // `%2e%2e` as input is inert once the `%` is itself encoded, so rejecting it
      // would refuse a value that is already safe.
      for (const value of ["1.2.3", "my.project", "...", "%2e%2e"]) {
        expect(() => apiPath`/projects/o/p/keys/${value}/`).not.toThrow();
      }
    });
  });
});

describe("withQuery", () => {
  it("appends a non-empty query and leaves the path alone otherwise", () => {
    expect(withQuery("/a/", new URLSearchParams({ q: "x y" }))).toBe(
      "/a/?q=x+y",
    );
    expect(withQuery("/a/", new URLSearchParams())).toBe("/a/");
  });
});

describe("encodeApiPathSegment", () => {
  it.each([".", ".."])("rejects a bare dot segment %s", (value) => {
    expect(encodeApiPathSegment(value)).toBeNull();
  });

  it.each([
    "release/feature",
    "../other-org",
    "%2e%2e",
    "abc/#",
    "..\\other-org",
  ])("keeps %s inside one path segment after URL parsing", (value) => {
    const segment = encodeApiPathSegment(value);
    expect(segment).not.toBeNull();
    const url = new URL(
      `https://sentry.io/api/0/organizations/my-org/releases/${segment}/`,
    );
    expect(url.pathname).toBe(
      `/api/0/organizations/my-org/releases/${encodeURIComponent(value)}/`,
    );
  });

  it("preserves ordinary identifiers and numeric IDs", () => {
    expect(encodeApiPathSegment("v1.2.3")).toBe("v1.2.3");
    expect(encodeApiPathSegment(42)).toBe("42");
  });
});

describe("buildSentryApiUrl", () => {
  it.each([
    [
      "https://sentry.io",
      "/organizations/org/",
      "https://sentry.io/api/0/organizations/org/",
    ],
    [
      "https://us.sentry.io/",
      "organizations/org/?cursor=a%3Ab",
      "https://us.sentry.io/api/0/organizations/org/?cursor=a%3Ab",
    ],
    [
      "https://self-hosted.example/sentry/",
      "/organizations/org/",
      "https://self-hosted.example/sentry/api/0/organizations/org/",
    ],
    [
      "https://self-hosted.example/sentry////",
      "organizations/org/",
      "https://self-hosted.example/sentry/api/0/organizations/org/",
    ],
  ])("assembles %s with %s", (baseUrl, endpoint, expected) => {
    expect(buildSentryApiUrl(baseUrl, endpoint)).toBe(expected);
  });

  it("preserves encoded identifiers without decoding them", () => {
    expect(buildSentryApiUrl("https://sentry.io", "issues/a%2Fb/")).toBe(
      "https://sentry.io/api/0/issues/a%2Fb/",
    );
  });
});

describe("parseApiPathScope", () => {
  it.each([
    ["organizations/acme/issues/", { organization: "acme" }],
    ["/api/0/organizations/acme/", { organization: "acme" }],
    [
      "organizations/acme/projects/web/keys/",
      { organization: "acme", project: "web" },
    ],
    [
      "projects/acme/web/events/?query=a",
      { organization: "acme", project: "web" },
    ],
    ["projects/acme/", { organization: "acme" }],
    ["teams/acme/backend/members/", { organization: "acme" }],
    ["organizations/123/issues/", { organization: "123" }],
    [
      "https://us.sentry.io/api/0/projects/acme/web/",
      { organization: "acme", project: "web" },
    ],
    [
      "https://self-hosted.example/sentry/api/0/organizations/acme/",
      { organization: "acme" },
    ],
  ])("reads the scope of %s", (input, expected) => {
    expect(parseApiPathScope(input)).toEqual(expected);
  });

  it.each([
    "organizations/",
    "users/me/",
    "issues/123/",
    "organizations/{organization_id_or_slug}/issues/",
    "organizations/a%2Fb/",
    "organizations/../users/",
    "https://sentry.io/organizations/acme/",
  ])("finds no scope in %s", (input) => {
    expect(parseApiPathScope(input)).toBeUndefined();
  });

  it("ignores a project segment that is not an identifier", () => {
    expect(
      parseApiPathScope("organizations/acme/projects/{project_id_or_slug}/"),
    ).toEqual({ organization: "acme" });
  });
});
