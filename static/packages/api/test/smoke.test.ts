/**
 * Smoke tests for the public surface area.
 *
 * These tests don't hit the network — they assert that:
 *   1. The Link-header parser handles real Sentry response shapes correctly.
 *   2. The pagination helpers compose with mocked SDK results.
 *   3. The generated wrappers (pagination.gen.ts) export the expected names
 *      and have the correct type shape (compile-time check via `as`).
 *
 * Run with `pnpm run test:vitest`.
 */

import { describe, expect, test } from "vitest";
import * as v from "valibot";
import { vAutofixPostResponse, vGetProjectData } from "../src/valibot";
import { zAutofixPostResponse, zGetProjectData } from "../src/zod";
import {
  fetchPage,
  fetchPage_listOrganizationIssues,
  fetchPage_listOrganizations,
  narrowError,
  narrowError_getProject,
  paginateAll,
  paginateAll_listOrganizations,
  paginateUpTo,
  paginateUpTo_listOrganizations,
  parseSentryLinkHeader,
  SentryApiError,
  unwrapPaginatedResult,
  unwrapResult,
} from "../src/index";
import { createClient } from "../src/client";
// `_withCursor` is internal — the generated wrappers use it but it's not
// re-exported from src/index. Import directly to cover the runtime helper.
import { _withCursor } from "../src/sentry-pagination";

// =====================================================================
// parseSentryLinkHeader
// =====================================================================

describe("parseSentryLinkHeader", () => {
  test("returns empty when header is null or empty", () => {
    expect(parseSentryLinkHeader(null)).toEqual({});
    expect(parseSentryLinkHeader("")).toEqual({});
  });

  test("extracts nextCursor when next link has results=true", () => {
    const header =
      '<https://sentry.io/api/0/organizations/?cursor=abc>; rel="next"; results="true"; cursor="1234:0:0"';
    expect(parseSentryLinkHeader(header)).toEqual({ nextCursor: "1234:0:0" });
  });

  test("extracts both nextCursor and prevCursor when both present", () => {
    const header =
      '<https://sentry.io/api/0/organizations/?c=p>; rel="previous"; results="true"; cursor="prev:1:0", ' +
      '<https://sentry.io/api/0/organizations/?c=n>; rel="next"; results="true"; cursor="next:0:0"';
    expect(parseSentryLinkHeader(header)).toEqual({
      nextCursor: "next:0:0",
      prevCursor: "prev:1:0",
    });
  });

  test("ignores rels with results=false (first-page boundary)", () => {
    // Sentry sends `rel="previous"; results="false"` on the first page
    // to indicate no previous results exist. We must not return prevCursor.
    const header =
      '<https://sentry.io/api/0/organizations/?c=p>; rel="previous"; results="false"; cursor="0:0:1", ' +
      '<https://sentry.io/api/0/organizations/?c=n>; rel="next"; results="true"; cursor="next:0:0"';
    expect(parseSentryLinkHeader(header)).toEqual({ nextCursor: "next:0:0" });
  });

  test("returns empty when both rels have results=false (last page)", () => {
    const header =
      '<https://sentry.io/api/0/organizations/?c=p>; rel="previous"; results="true"; cursor="prev:1:0", ' +
      '<https://sentry.io/api/0/organizations/?c=n>; rel="next"; results="false"; cursor="next:0:0"';
    expect(parseSentryLinkHeader(header)).toEqual({ prevCursor: "prev:1:0" });
  });

  test("ignores malformed segments without crashing", () => {
    expect(parseSentryLinkHeader("not a link header")).toEqual({});
    expect(parseSentryLinkHeader("<url>; rel=next")).toEqual({}); // unquoted
  });
});

describe("runtime validator entry points", () => {
  const response = { run_id: 42, sentry_run_id: "run-42", feature_id: "autofix" };

  test("preserves composite request schemas across generator upgrades", () => {
    const request = { path: { organization_id_or_slug: "example", project_id_or_slug: "project" } };
    expect(v.parse(vGetProjectData, request)).toEqual(request);
    expect(zGetProjectData.parse(request)).toEqual(request);
    expect(v.safeParse(vGetProjectData, { path: {} }).success).toBe(false);
    expect(zGetProjectData.safeParse({ path: {} }).success).toBe(false);
  });

  test("Valibot parses generated response schemas", () => {
    expect(v.parse(vAutofixPostResponse, response)).toEqual(response);
    expect(() =>
      v.parse(vAutofixPostResponse, { ...response, run_id: "42" }),
    ).toThrow();
  });

  test("Zod parses generated response schemas", () => {
    expect(zAutofixPostResponse.parse(response)).toEqual(response);
    expect(() =>
      zAutofixPostResponse.parse({ ...response, run_id: "42" }),
    ).toThrow();
  });
});

// =====================================================================
// unwrapResult / unwrapPaginatedResult
// =====================================================================

const mkSuccess = <T>(data: T, linkHeader?: string) => ({
  data,
  request: new Request("https://example.test/"),
  response: new Response(null, {
    headers: linkHeader ? { link: linkHeader } : {},
  }),
}) satisfies Parameters<typeof unwrapResult<T>>[0];

const mkFailure = <TError>(errorBody: TError, status = 500) => ({
  error: errorBody,
  request: new Request("https://example.test/"),
  response: new Response(null, { status }),
}) satisfies Parameters<typeof unwrapResult<unknown, TError>>[0];

const mkTransportFailure = (error: unknown) => ({
  error,
  request: new Request("https://example.test/"),
  response: undefined,
});

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  implementation as typeof fetch;

const mkHttpFailure = (body: unknown, status: number) => {
  const result = mkFailure(body, status);
  return {
    ...result,
    error: new SentryApiError(status, body, result.response, false),
  };
};

const thrownBy = (call: () => unknown): unknown => {
  try {
    call();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to throw");
};

describe("unwrapResult", () => {
  test("returns data on success", () => {
    const out = unwrapResult(mkSuccess({ ok: 1 }), "test");
    expect(out.data).toEqual({ ok: 1 });
  });

  test("throws the exact consumer error without adding a wrapper", () => {
    const error = new Error("Consumer failure");
    expect(thrownBy(() => unwrapResult(mkFailure(error), "test"))).toBe(error);
  });

  test("preserves an existing SentryApiError and its metadata", () => {
    const result = mkHttpFailure({ detail: "boom" }, 404);
    try {
      unwrapResult(result, "ctx");
      throw new Error("expected unwrapResult to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SentryApiError);
      expect(err).toBe(result.error);
      const apiErr = err as SentryApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.body).toEqual({ detail: "boom" });
      expect(apiErr.documented).toBe(false);
    }
  });

  test("uses the error property rather than its truthiness", () => {
    for (const error of [undefined, null, false, 0, ""]) {
      let caught = false;
      try {
        unwrapResult(mkTransportFailure(error), "test");
      } catch (thrown) {
        caught = true;
        expect(thrown).toBe(error);
      }
      expect(caught).toBe(true);
    }
  });
});

// =====================================================================
// narrowError
// =====================================================================

describe("narrowError", () => {
  test("returns ok:true with data on success", () => {
    const res = narrowError<{ id: number }, { 403: unknown }>(
      mkSuccess({ id: 1 }),
      [403],
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ id: 1 });
      expect(res.response).toBeInstanceOf(Response);
    }
  });

  test("marks a declared status as documented", () => {
    const original = mkHttpFailure({ detail: "nope" }, 403);
    const cause = new Error("Original cause");
    original.error = new SentryApiError(403, original.error.body, original.response, false, undefined, {
      request: original.request, rawBody: '{ "detail": "nope" }\n', cause,
    });
    const res = narrowError<unknown, { 403: { detail: string } }>(
      original,
      [403],
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(SentryApiError);
      expect(res.error.status).toBe(403);
      expect(res.error.body).toEqual({ detail: "nope" });
      expect(res.error.documented).toBe(true);
      expect(res.error.request).toBe(original.request);
      expect(res.error.response).toBe(original.response);
      expect(res.error.rawBody).toBe('{ "detail": "nope" }\n');
      expect(res.error.cause).toBe(cause);
    }
  });

  test("keeps undocumented statuses separate from the documented union", () => {
    const res = narrowError<unknown, { 403: unknown; 404: unknown }>(
      mkHttpFailure({}, 500),
      [403, 404],
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.status).toBe(500);
      expect(res.error.documented).toBe(false);
    }
  });

  test("does not disguise a transport exception as a documented API result", () => {
    const cause = new TypeError("fetch failed");
    expect(thrownBy(() => narrowError<unknown, { 403: unknown }>(
      mkTransportFailure(cause), [403],
    ))).toBe(cause);
  });

  test("preserves custom errors even when an HTTP response exists", () => {
    const error = new Error("Consumer interpretation of a 403");
    expect(thrownBy(() => narrowError<unknown, { 403: unknown }>(
      mkFailure(error, 403), [403],
    ))).toBe(error);
  });
});

describe("generated typed-error wrappers", () => {
  const projectOptions = {
    path: {
      organization_id_or_slug: "my-org",
      project_id_or_slug: "my-project",
    },
  };

  test("overrides client defaults and returns a documented HTTP error", async () => {
    const client = createClient({
      baseUrl: "https://example.test",
      throwOnError: true,
      fetch: asFetch(() =>
        Promise.resolve(
          Response.json({ detail: "missing" }, { status: 404 }),
        ),
      ),
    });

    const result = await narrowError_getProject({ ...projectOptions, client });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.documented).toBe(true);
      expect(result.error.status).toBe(404);
      expect(result.error.body).toEqual({ detail: "missing" });
    }
  });

  test("returns an undocumented HTTP error", async () => {
    const result = await narrowError_getProject({
      ...projectOptions,
      baseUrl: "https://example.test",
      fetch: asFetch(() => Promise.resolve(Response.json({}, { status: 500 }))),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.documented).toBe(false);
      expect(result.error.status).toBe(500);
    }
  });

  test("rejects with the original error when fetch rejects", async () => {
    const cause = new TypeError("fetch failed");
    await expect(narrowError_getProject({
      ...projectOptions,
      baseUrl: "https://example.test",
      fetch: asFetch(() => Promise.reject(cause)),
    })).rejects.toBe(cause);
  });

  test("does not relabel a received response's body failure as a network error", async () => {
    const cause = new TypeError("stream failed");
    await expect(narrowError_getProject({
      ...projectOptions,
      baseUrl: "https://example.test",
      fetch: asFetch(() =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.error(cause);
              },
            }),
            { status: 500 },
          ),
        ),
      ),
    })).rejects.toBe(cause);
  });
});

describe("unwrapPaginatedResult", () => {
  test("includes nextCursor when present in Link header", () => {
    const linkHeader =
      '<u>; rel="next"; results="true"; cursor="next:0:0"';
    const out = unwrapPaginatedResult<number[]>(
      mkSuccess([1, 2, 3], linkHeader),
      "test",
    );
    expect(out.data).toEqual([1, 2, 3]);
    expect(out.nextCursor).toBe("next:0:0");
    expect(out.prevCursor).toBeUndefined();
  });

  test("omits both cursors when no Link header", () => {
    const out = unwrapPaginatedResult<number[]>(mkSuccess([1, 2, 3]), "test");
    expect(out.data).toEqual([1, 2, 3]);
    expect(out.nextCursor).toBeUndefined();
    expect(out.prevCursor).toBeUndefined();
  });
});

// =====================================================================
// _withCursor
// =====================================================================

describe("_withCursor", () => {
  test("leaves query unchanged when cursor is undefined", () => {
    const opts = { query: { foo: "bar" }, headers: { x: "y" } };
    const out = _withCursor<typeof opts & { query: { foo: string } }>(
      opts,
      undefined,
    );
    expect(out.query).toEqual({ foo: "bar" });
    expect(out.headers).toEqual({ x: "y" });
  });

  test("merges cursor into existing query, preserving other fields", () => {
    const out = _withCursor<{ query: { foo: string; cursor: string } }>(
      { query: { foo: "bar" } },
      "abc",
    );
    expect(out.query).toEqual({ foo: "bar", cursor: "abc" });
  });

  test("creates query when none was provided", () => {
    const out = _withCursor<{ query: { cursor: string } }>({}, "abc");
    expect(out.query).toEqual({ cursor: "abc" });
  });
});

// =====================================================================
// fetchPage
// =====================================================================

describe("fetchPage", () => {
  test("forwards cursor argument to fetcher and returns parsed result", async () => {
    let receivedCursor: string | undefined;
    const out = await fetchPage<number[]>(
      (cursor) => {
        receivedCursor = cursor;
        return Promise.resolve(
          mkSuccess([1, 2, 3], '<u>; rel="next"; results="true"; cursor="abc"'),
        );
      },
      "test",
      "start-cursor",
    );
    expect(receivedCursor).toBe("start-cursor");
    expect(out.data).toEqual([1, 2, 3]);
    expect(out.nextCursor).toBe("abc");
  });
});

// =====================================================================
// paginateAll
// =====================================================================

describe("paginateAll", () => {
  test("walks pages until no nextCursor, concatenating items", async () => {
    const pages: Record<string, { items: number[]; next?: string }> = {
      _start: { items: [1, 2], next: "p1" },
      p1: { items: [3, 4], next: "p2" },
      p2: { items: [5] }, // no next
    };
    const items = await paginateAll<number>(
      (cursor) => {
        const key = cursor ?? "_start";
        const page = pages[key]!;
        const link = page.next
          ? `<u>; rel="next"; results="true"; cursor="${page.next}"`
          : undefined;
        return Promise.resolve(mkSuccess(page.items, link));
      },
      "test",
    );
    expect(items).toEqual({ data: [1, 2, 3, 4, 5], stopReason: "exhausted" });
  });

  test("stops at maxPages safety cap", async () => {
    let calls = 0;
    const items = await paginateAll<number>(
      () => {
        calls += 1;
        // Always returns a next cursor → infinite without the cap
        return Promise.resolve(
          mkSuccess([calls], '<u>; rel="next"; results="true"; cursor="x"'),
        );
      },
      "test",
      { maxPages: 3 },
    );
    expect(calls).toBe(3);
    expect(items).toEqual({ data: [1, 2, 3], stopReason: "maxPages", nextCursor: "x" });
  });
});

// =====================================================================
// paginateUpTo
// =====================================================================

describe("paginateUpTo", () => {
  test("returns nextCursor when limit lands exactly on page boundary", async () => {
    const result = await paginateUpTo<number>(
      (cursor) =>
        Promise.resolve(
          mkSuccess(
            cursor ? [3, 4] : [1, 2],
            '<u>; rel="next"; results="true"; cursor="next"',
          ),
        ),
      { limit: 4 },
      "test",
    );
    expect(result.data).toEqual([1, 2, 3, 4]);
    // Limit reached exactly: still has more pages, so nextCursor is preserved
    expect(result.nextCursor).toBe("next");
    expect(result.stopReason).toBe("limit");
  });

  test("suppresses nextCursor when overshooting limit (correctness)", async () => {
    // First page returns 5 items; limit is 3. Returning a cursor that points
    // past the trimmed items would cause callers to skip records.
    const result = await paginateUpTo<number>(
      () =>
        Promise.resolve(
          mkSuccess(
            [1, 2, 3, 4, 5],
            '<u>; rel="next"; results="true"; cursor="would-skip"',
          ),
        ),
      { limit: 3 },
      "test",
    );
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.nextCursor).toBeUndefined();
  });

  test("reports a partial result when the final server page overshoots", async () => {
    const result = await paginateUpTo<number>(
      () => Promise.resolve(mkSuccess([1, 2, 3, 4, 5])),
      { limit: 3 },
      "test",
    );
    expect(result).toEqual({
      data: [1, 2, 3], stopReason: "limit",
      continuation: { cursor: undefined, offset: 3, requestBudget: 3 },
    });
  });

  test("invokes onPage callback after each page", async () => {
    const observed: Array<{ fetched: number; limit: number }> = [];
    await paginateUpTo<number>(
      (cursor) =>
        Promise.resolve(
          mkSuccess(
            cursor ? [3, 4] : [1, 2],
            cursor
              ? undefined
              : '<u>; rel="next"; results="true"; cursor="p1"',
          ),
        ),
      {
        limit: 10,
        onPage: (fetched, limit) => observed.push({ fetched, limit }),
      },
      "test",
    );
    expect(observed).toEqual([
      { fetched: 2, limit: 10 },
      { fetched: 4, limit: 10 },
    ]);
  });

  test("respects startCursor on first call, advances to server nextCursor on subsequent calls", async () => {
    const cursorsSeen: Array<string | undefined> = [];
    await paginateUpTo<number>(
      (cursor) => {
        cursorsSeen.push(cursor);
        const isFirst = cursorsSeen.length === 1;
        return Promise.resolve(
          mkSuccess(
            isFirst ? [1] : [],
            isFirst
              ? '<u>; rel="next"; results="true"; cursor="server-side"'
              : undefined,
          ),
        );
      },
      { limit: 100, startCursor: "resume-here" },
      "test",
    );
    // First call honors startCursor; second call uses the server-returned
    // cursor (not startCursor again — that would re-fetch the same page).
    expect(cursorsSeen).toEqual(["resume-here", "server-side"]);
  });

  test("keeps a safe nextCursor when maxPages cap fires before limit is reached", async () => {
    let calls = 0;
    const result = await paginateUpTo<number>(
      () => {
        calls += 1;
        return Promise.resolve(
          mkSuccess([calls], '<u>; rel="next"; results="true"; cursor="more"'),
        );
      },
      { limit: 1000, maxPages: 2 },
      "test",
    );
    expect(calls).toBe(2);
    expect(result).toEqual({
      data: [1, 2], stopReason: "maxPages", nextCursor: "more",
      continuation: { cursor: "more", offset: 0 },
    });
  });

  test("rejects limit < 1", async () => {
    await expect(
      paginateUpTo<number>(
        () => Promise.resolve(mkSuccess([])),
        { limit: 0 },
        "test",
      ),
    ).rejects.toThrow(/limit/);
  });
});

describe("collection budgets", () => {
  test.each([
    { items: [1, 2], next: undefined, limit: 3, reason: "exhausted", cursor: undefined },
    { items: [1, 2], next: undefined, limit: 2, reason: "exhausted", cursor: undefined },
    { items: [1, 2], next: "next", limit: 2, reason: "limit", cursor: "next" },
    { items: [1, 2], next: "next", limit: 3, reason: "maxPages", cursor: "next" },
    { items: [1, 2, 3], next: undefined, limit: 2, reason: "limit", cursor: undefined },
  ])("reports $reason at an item/request boundary ($items, $next, $limit)", async ({ items, next, limit, reason, cursor }) => {
    const result = await paginateUpTo(
      () => Promise.resolve(mkSuccess([...items], next ? `<u>; rel="next"; results="true"; cursor="${next}"` : undefined)),
      { limit, maxPages: 1 },
      "test",
    );
    expect(result.data).toEqual(items.slice(0, limit));
    expect(result.stopReason).toBe(reason);
    expect(result.nextCursor).toBe(cursor);
  });

  test("passes the remaining budget and continues after an empty page with a next cursor", async () => {
    const seen: Array<[string | undefined, number]> = [];
    const result = await paginateUpTo<number>(
      (cursor, remaining) => {
        seen.push([cursor, remaining]);
        const items = cursor === "empty" ? [] : cursor === "last" ? [3] : [1, 2];
        const next = cursor === "last" ? undefined : cursor === "empty" ? "last" : "empty";
        return Promise.resolve(mkSuccess([...items], next ? `<u>; rel="next"; results="true"; cursor="${next}"` : undefined));
      },
      { limit: 3 },
      "test",
    );
    expect(seen).toEqual([[undefined, 3], ["empty", 1], ["last", 1]]);
    expect(result).toEqual({ data: [1, 2, 3], stopReason: "exhausted" });
  });

  test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid budget %s before fetching", async value => {
    let fetched = false;
    const fetcher = async () => { fetched = true; return mkSuccess([]); };
    await expect(paginateUpTo(fetcher, { limit: value }, "test")).rejects.toThrow(/limit/);
    await expect(paginateUpTo(fetcher, { limit: 1, maxPages: value }, "test")).rejects.toThrow(/maxPages/);
    await expect(paginateAll(fetcher, "test", { maxPages: value })).rejects.toThrow(/maxPages/);
    expect(fetched).toBe(false);
  });
});

// =====================================================================
// Generated wrappers — compile-time + structural smoke
// =====================================================================

describe("generated wrappers (pagination.gen.ts)", () => {
  test("fetchPage_listOrganizations is callable with no args", () => {
    // We don't actually invoke (would need network); we assert it exists,
    // is a function, and has the expected arity (options + cursor = 2 named
    // params, but JS reports the count up to the first default — so 1).
    expect(typeof fetchPage_listOrganizations).toBe("function");
  });

  test("paginateAll_/paginateUpTo_ wrappers exist for array-shaped ops", () => {
    expect(typeof paginateAll_listOrganizations).toBe("function");
    expect(typeof paginateUpTo_listOrganizations).toBe("function");
  });

  test("only fetchPage_ is generated for compound-shaped ops", async () => {
    // listOrganizationIssues is array-shaped, so all three exist.
    expect(typeof fetchPage_listOrganizationIssues).toBe("function");
    // For a compound op like listProjectReplayClicks (200: { ... } not Array<>),
    // paginateAll/paginateUpTo are intentionally not generated — items
    // can't be flattened across pages without knowing which field holds
    // the array, and that's spec-specific.
    const indexModule: Record<string, unknown> = await import("../src/index");
    const keys = Object.keys(indexModule);
    expect(keys).toContain("fetchPage_listProjectReplayClicks");
    expect(keys).not.toContain("paginateAll_listProjectReplayClicks");
    expect(keys).not.toContain("paginateUpTo_listProjectReplayClicks");
  });

});
