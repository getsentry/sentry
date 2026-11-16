import { describe, expect, test } from "vitest";
import {
  consumePage,
  createSentryClient,
  fetchPage,
  paginateUpTo,
  paginateUpTo_listOrganizationProjects,
  type CollectionPageFetcher,
  type Config,
  type PaginationContinuation,
  type SdkResult,
} from "@sentry/api";

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(new Request(input, init))) as NonNullable<Config["fetch"]>;
const link = (cursor: string) =>
  `<https://unrelated.example.test/>; rel="next"; results="true"; cursor="${cursor}"`;
const rows = (start: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: String(start + index) }));
const success = <T>(data: T, nextCursor?: string): SdkResult<T> => ({
  data,
  request: new Request("https://example.test/api/0/items/"),
  response: Response.json(data, { headers: nextCursor ? { Link: link(nextCursor) } : {} }),
});
const persisted = (continuation: PaginationContinuation | undefined): PaginationContinuation => {
  expect(continuation).toBeDefined();
  return JSON.parse(JSON.stringify(continuation));
};

describe("pagination continuation", () => {
  test("resumes fixed-size project pages across changed limits and serialized continuations", async () => {
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://configured.example.test",
      headers: { Authorization: "Bearer configured" },
      fetch: asFetch(async request => {
        requests.push(request);
        const query = new URL(request.url).searchParams;
        expect(query.get("per_page")).toBe("100");
        // OffsetPaginator cursors retain the original page size and page number.
        const cursor = query.get("cursor")?.split(":");
        const start = cursor ? Number(cursor[0]) * Number(cursor[1]) : 0;
        const count = Math.min(100, 420 - start);
        return Response.json(rows(start, count), {
          headers: start + count < 420 ? { Link: link(`100:${start / 100 + 1}:0`) } : {},
        });
      }),
    });
    const options = {
      path: { organization_id_or_slug: "example" },
      query: { query: "selected-projects", per_page: 100 },
    };
    const first = await sentry.paginateUpTo.listOrganizationProjects(options, { limit: 250 });
    const second = await paginateUpTo_listOrganizationProjects(
      { ...options, client: sentry.client },
      { limit: 25, resume: persisted(first.continuation) },
    );
    const third = await sentry.paginateUpTo.listOrganizationProjects(options, {
      limit: 80, resume: persisted(second.continuation),
    });
    const last = await sentry.paginateUpTo.listOrganizationProjects(options, {
      limit: 100, resume: persisted(third.continuation),
    });

    expect(first.nextCursor).toBeUndefined();
    expect(first.continuation).toEqual({ cursor: "100:2:0", offset: 50, requestBudget: 50 });
    expect([first, second, third].map(batch => batch.stopReason)).toEqual(["limit", "limit", "limit"]);
    expect(last.stopReason).toBe("exhausted");
    expect(last.continuation).toBeUndefined();
    expect([first, second, third, last].flatMap(batch => batch.data.map(item => item.id)))
      .toEqual(rows(0, 420).map(item => item.id));
    expect(requests.map(request => new URL(request.url).searchParams.get("cursor")))
      .toEqual([null, "100:1:0", "100:2:0", "100:2:0", "100:2:0", "100:3:0", "100:3:0", "100:4:0"]);
    for (const request of requests) {
      const url = new URL(request.url);
      expect(url.origin).toBe("https://configured.example.test");
      expect(url.searchParams.get("query")).toBe("selected-projects");
      expect(request.headers.get("Authorization")).toBe("Bearer configured");
    }
    expect(options.query.per_page).toBe(100);
  });

  test("replays a custom fetcher's original budget until its opaque page is consumed", async () => {
    const calls: Array<[string | undefined, number]> = [];
    const starts = new Map([["opaque-next/A", 6], ["opaque-next/B", 12]]);
    const fetcher = async (cursor: string | undefined, budget: number) => {
      calls.push([cursor, budget]);
      const start = cursor === undefined ? 0 : starts.get(cursor)!;
      // A consumer can transform the budget; it need not equal an HTTP page size.
      const end = Math.min(14, start + budget + 2);
      const next = end === 6 ? "opaque-next/A" : end === 12 ? "opaque-next/B" : undefined;
      return success(rows(start, end - start), next);
    };
    const first = await paginateUpTo(fetcher, { limit: 4 }, "custom");
    const second = await paginateUpTo(fetcher, { limit: 1, resume: persisted(first.continuation) }, "custom");
    const third = await paginateUpTo(fetcher, { limit: 5, resume: persisted(second.continuation) }, "custom");
    const last = await paginateUpTo(fetcher, { limit: 20, resume: persisted(third.continuation) }, "custom");

    expect([first, second, third, last].flatMap(batch => batch.data.map(item => item.id)))
      .toEqual(rows(0, 14).map(item => item.id));
    expect(calls).toEqual([
      [undefined, 4], [undefined, 4], [undefined, 4],
      ["opaque-next/A", 4], ["opaque-next/A", 4], ["opaque-next/B", 18],
    ]);
    expect(last.stopReason).toBe("exhausted");
  });

  test("retains the unconsumed final page even when there is no server cursor", async () => {
    const calls: Array<[string | undefined, number]> = [];
    const fetcher = async (cursor: string | undefined, budget: number) => {
      calls.push([cursor, budget]);
      return success(["first", "second", "third"]);
    };
    const first = await paginateUpTo(fetcher, { limit: 1 }, "final-page");
    const second = await paginateUpTo(fetcher, { limit: 1, resume: persisted(first.continuation) }, "final-page");
    const last = await paginateUpTo(fetcher, { limit: 2, resume: persisted(second.continuation) }, "final-page");

    expect(first.nextCursor).toBeUndefined();
    expect(persisted(first.continuation)).toEqual({ offset: 1, requestBudget: 1 });
    expect(first.stopReason).toBe("limit");
    expect(second.stopReason).toBe("limit");
    expect(last.stopReason).toBe("exhausted");
    expect(last.continuation).toBeUndefined();
    expect([...first.data, ...second.data, ...last.data]).toEqual(["first", "second", "third"]);
    expect(calls).toEqual([[undefined, 1], [undefined, 1], [undefined, 1]]);
  });

  test("resumes normalized pages without HTTP objects and preserves consumer failures", async () => {
    const calls: Array<[string | undefined, number]> = [];
    const failure = new Error("Consumer could not fetch the next page");
    let fail = false;
    const fetcher: CollectionPageFetcher<number> = async (cursor, budget) => {
      calls.push([cursor, budget]);
      if (cursor === undefined) return { data: [1, 2, 3], nextCursor: "consumer-next", request: undefined };
      if (fail) throw failure;
      return { data: [4, 5] };
    };
    const first = await paginateUpTo(fetcher, { limit: 2 }, "normalized");
    const resume = persisted(first.continuation);
    const last = await paginateUpTo(fetcher, { limit: 5, resume }, "normalized");

    expect([...first.data, ...last.data]).toEqual([1, 2, 3, 4, 5]);
    expect(last.stopReason).toBe("exhausted");
    expect(last.continuation).toBeUndefined();
    expect(calls).toEqual([[undefined, 2], [undefined, 2], ["consumer-next", 4]]);

    fail = true;
    const error = await paginateUpTo(fetcher, { limit: 5, resume }, "normalized").catch(error => error);
    expect(error).toBe(failure);
    expect(calls.slice(3)).toEqual([[undefined, 2], ["consumer-next", 4]]);
  });

  test("composes fetchPage while honoring the consumer's next cursor over retained Link headers", async () => {
    const requests: Request[] = [];
    const cursors: Array<string | undefined> = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        requests.push(request);
        const final = new URL(request.url).searchParams.get("cursor") === "server-next";
        return Response.json(final ? rows(3, 2) : rows(0, 3), {
          headers: { Link: link(final ? "stale-after-final" : "server-next") },
        });
      }),
    });
    const fetcher = async (cursor: string | undefined) => {
      cursors.push(cursor);
      if (cursor !== undefined && cursor !== "consumer-next") throw new Error("Unexpected consumer cursor");
      const page = await sentry.fetchPage.listOrganizations(
        { query: { per_page: 3 } },
        cursor === "consumer-next" ? "server-next" : undefined,
      );
      // A consumer can normalize navigation while retaining the original Response.
      return { ...page, nextCursor: cursor === undefined ? "consumer-next" : undefined };
    };
    const first = await paginateUpTo(fetcher, { limit: 2 }, "composed");
    const last = await paginateUpTo(fetcher, {
      limit: 10, resume: persisted(first.continuation),
    }, "composed");

    expect([...first.data, ...last.data].map(item => item.id)).toEqual(rows(0, 5).map(item => item.id));
    expect(last.stopReason).toBe("exhausted");
    expect(last.nextCursor).toBeUndefined();
    expect(last.continuation).toBeUndefined();
    expect(cursors).toEqual([undefined, undefined, "consumer-next"]);
    expect(requests.map(request => new URL(request.url).searchParams.get("cursor")))
      .toEqual([null, null, "server-next"]);
  });

  test("keeps custom navigation and compound page bodies independent from collection continuation", async () => {
    const body = { data: [{ id: "one" }], meta: { fields: { id: "string" } } };
    const result = success(body, "server-next");
    const requested: Array<string | undefined> = [];
    const page = await fetchPage(async bookmark => {
      requested.push(bookmark?.split("|")[1]);
      return result;
    }, "custom-bookmark", "client-state|server-start");

    expect(requested).toEqual(["server-start"]);
    expect(page.data).toBe(body);
    expect(page.response).toBe(result.response!);
    expect(page.nextCursor).toBe("server-next");
    expect("continuation" in page).toBe(false);

    const failure = new Error("Consumer-specific failure");
    const error = await fetchPage(async () => ({
      error: failure,
      request: result.request,
      response: undefined,
    }), "custom-bookmark").catch(error => error);
    expect(error).toBe(failure);
  });

  test("consumes an already fetched page without owning its envelope or navigation state", () => {
    const envelope = { data: ["a", "b", "c"], meta: { count: 4 } };
    const page = { data: envelope.data, nextCursor: "opaque-next" };
    const first = consumePage(page, Object.freeze({ offset: 0 }), 2);
    const rest = consumePage(page, first.position!);
    const last = consumePage({ data: ["d"] }, rest.position!);
    const output = { ...envelope, data: first.data };

    expect(first.data).toEqual(["a", "b"]);
    expect(rest.data).toEqual(["c"]);
    expect(rest.position).toEqual({ cursor: "opaque-next", offset: 0 });
    expect(last.data).toEqual(["d"]);
    expect(last.position).toBeUndefined();
    expect(output.meta).toBe(envelope.meta);
    expect(envelope.data).toEqual(["a", "b", "c"]);
    expect(page.nextCursor).toBe("opaque-next");
  });

  test("carries an offset through shorter and empty pages with opaque cursors", async () => {
    const pages = [
      { data: [1, 2], nextCursor: "opaque/A" },
      { data: [], nextCursor: "opaque/B" },
      { data: [3, 4, 5, 6] },
    ];
    const resume = { offset: 5, requestBudget: 7 };
    const first = consumePage(pages[0]!, resume);
    const empty = consumePage(pages[1]!, first.position!);
    const last = consumePage(pages[2]!, empty.position!);

    expect(first).toEqual({ data: [], position: { cursor: "opaque/A", offset: 3 } });
    expect(empty).toEqual({ data: [], position: { cursor: "opaque/B", offset: 3 } });
    expect(last).toEqual({ data: [6] });

    const cursors: Array<string | undefined> = [];
    const result = await paginateUpTo(async cursor => {
      cursors.push(cursor);
      return pages[cursor === "opaque/A" ? 1 : cursor === "opaque/B" ? 2 : 0]!;
    }, { limit: 2, resume }, "short-pages");

    expect(cursors).toEqual([undefined, "opaque/A", "opaque/B"]);
    expect(result).toEqual({ data: [6], stopReason: "exhausted" });
  });

  test("counts a replayed partial page toward the request cap and resumes at its boundary", async () => {
    const calls: Array<string | undefined> = [];
    const fetcher = async (cursor: string | undefined) => {
      calls.push(cursor);
      return cursor === undefined ? success([1, 2, 3], "next") : success([4, 5, 6]);
    };
    const first = await paginateUpTo(fetcher, { limit: 2 }, "capped");
    const capped = await paginateUpTo(fetcher, {
      limit: 5, maxPages: 1, resume: persisted(first.continuation),
    }, "capped");
    const last = await paginateUpTo(fetcher, {
      limit: 5, resume: persisted(capped.continuation),
    }, "capped");

    expect(capped.data).toEqual([3]);
    expect(capped.stopReason).toBe("maxPages");
    expect(capped.nextCursor).toBe("next");
    expect(capped.continuation).toEqual({ cursor: "next", offset: 0 });
    expect(last.data).toEqual([4, 5, 6]);
    expect(last.stopReason).toBe("exhausted");
    expect(calls).toEqual([undefined, undefined, "next"]);
  });

  test("propagates a mapped error after replaying a partial page instead of returning partial success", async () => {
    const requests: Request[] = [];
    const failure = new Error("Consumer-specific API error");
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        requests.push(request);
        if (new URL(request.url).searchParams.has("cursor")) {
          return Response.json({ detail: "Unavailable" }, { status: 503 });
        }
        return Response.json(rows(0, 3), { headers: { Link: link("next") } });
      }),
    });
    sentry.client.interceptors.error.use(() => failure);
    const first = await sentry.paginateUpTo.listOrganizations({}, { limit: 2 });
    const error = await sentry.paginateUpTo.listOrganizations({}, {
      limit: 5, resume: persisted(first.continuation),
    }).catch(error => error);

    expect(error).toBe(failure);
    expect(requests.map(request => new URL(request.url).searchParams.get("cursor")))
      .toEqual([null, null, "next"]);
  });

  test("preserves cancellation between a replayed partial page and the next request", async () => {
    const controller = new AbortController();
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        requests.push(request);
        return Response.json(rows(0, 3), { headers: { Link: link("next") } });
      }),
    });
    const first = await sentry.paginateUpTo.listOrganizations({}, { limit: 2 });
    const reason = new Error("Stop after the resumed page");
    const progress: number[] = [];
    const error = await sentry.paginateUpTo.listOrganizations({ signal: controller.signal }, {
      limit: 5,
      resume: persisted(first.continuation),
      onPage: fetched => { progress.push(fetched); controller.abort(reason); },
    }).catch(error => error);

    expect(error).toBe(reason);
    expect(progress).toEqual([1]);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.signal.aborted).toBe(true);
  });

  test("rejects ambiguous resume input before calling the fetcher", async () => {
    let calls = 0;
    const fetcher = async () => { calls++; return success([1]); };
    await expect(paginateUpTo(fetcher, {
      limit: 1, startCursor: "other", resume: { cursor: "saved", offset: 0 },
    }, "ambiguous")).rejects.toThrow();
    expect(calls).toBe(0);
  });
});
