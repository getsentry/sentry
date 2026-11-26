import { describe, expect, test } from "vitest";
import { parseSentryLinkHeader, parseSentryLinks, readSentryResponseHeaders } from "../src/index";

const previous = '<https://sentry.io/api/0/organizations/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1"';
const next = '<https://sentry.io/api/0/organizations/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

describe("parseSentryLinks", () => {
  test("keeps the href, results and cursor of each rel", () => {
    expect(parseSentryLinks(`${previous}, ${next}`)).toEqual({
      previous: { href: "https://sentry.io/api/0/organizations/?cursor=0:0:1", results: false, cursor: "0:0:1" },
      next: { href: "https://sentry.io/api/0/organizations/?cursor=0:100:0", results: true, cursor: "0:100:0" },
    });
  });

  test("keeps a rel without results or cursor, with results null", () => {
    expect(parseSentryLinks('<https://sentry.io/api/0/>; rel="first"')).toEqual({
      first: { href: "https://sentry.io/api/0/", results: null },
    });
  });

  test("lets a later target replace an earlier one with the same rel", () => {
    const later = '<https://sentry.io/later/>; rel="next"; results="false"; cursor="later"';
    expect(parseSentryLinks(`${next}, ${later}`).next).toEqual({
      href: "https://sentry.io/later/", results: false, cursor: "later",
    });
  });

  test("skips targets without a URL or a quoted rel", () => {
    expect(parseSentryLinks(null)).toEqual({});
    expect(parseSentryLinks("")).toEqual({});
    expect(parseSentryLinks('rel="next"; results="true"; cursor="1"')).toEqual({});
    expect(parseSentryLinks("<https://sentry.io/>; rel=next")).toEqual({});
  });

  test("agrees with the cursors parseSentryLinkHeader returns", () => {
    const header = `${previous}, ${next}`;
    const links = parseSentryLinks(header);
    expect(parseSentryLinkHeader(header)).toEqual({ nextCursor: links.next?.cursor });
  });
});

describe("readSentryResponseHeaders", () => {
  test("reads Link, the hit counts as numbers, and the direct hit flag", () => {
    const headers = new Headers({ Link: next, "X-Hits": "42", "X-Max-Hits": "1000", "X-Sentry-Direct-Hit": "1" });
    expect(readSentryResponseHeaders(headers)).toEqual({ link: next, hits: 42, maxHits: 1000, directHit: true });
  });

  test("omits missing headers and reports no direct hit", () => {
    expect(readSentryResponseHeaders(new Headers())).toEqual({ directHit: false });
  });

  test.each(["", " ", "abc", "1.5", "-1", "1e400"])("omits a malformed count %j", value => {
    const headers = new Headers({ "X-Hits": value, "X-Max-Hits": value });
    expect(readSentryResponseHeaders(headers)).toEqual({ directHit: false });
  });

  test("reads a count of zero", () => {
    expect(readSentryResponseHeaders(new Headers({ "X-Hits": "0" })).hits).toBe(0);
  });
});
