import { describe, expect, test } from "vitest";
import { createSentryClient, paginateUpTo_listOrganizationIssues, SentryApiError, type Config } from "@sentry/api";

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(new Request(input, init))) as NonNullable<Config["fetch"]>;
const link = (cursor: string) =>
  `<https://unrelated.example.test/>; rel="next"; results="true"; cursor="${cursor}"`;
const rows = (start: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: String(start + index) }));
const path = { organization_id_or_slug: "example" };

describe("collection HTTP budgets", () => {
  test("collects 100 + 100 + 50 issues and resumes without gaps through the same transport", async () => {
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://configured.example.test",
      headers: { Authorization: "Bearer configured" },
      fetch: asFetch(async request => {
        requests.push(request);
        const query = new URL(request.url).searchParams;
        const size = Number(query.get("limit"));
        const start = Number(query.get("cursor")?.split(":")[1] ?? 0);
        const end = Math.min(start + size, 400);
        return Response.json(rows(start, end - start), {
          headers: end < 400 ? { Link: link(`opaque:${end}`) } : {},
        });
      }),
    });
    sentry.client.interceptors.request.use(request => {
      request.headers.set("X-Context", "pagination");
      return request;
    });
    const options = { path, query: { query: "is:unresolved", limit: 100 } };
    const first = await sentry.paginateUpTo.listOrganizationIssues(options, { limit: 250 });
    const second = await paginateUpTo_listOrganizationIssues(
      { ...options, client: sentry.client },
      { limit: 250, startCursor: first.nextCursor },
    );

    expect(first.stopReason).toBe("limit");
    expect(first.nextCursor).toBe("opaque:250");
    expect(second.stopReason).toBe("exhausted");
    expect(second.nextCursor).toBeUndefined();
    expect([...first.data, ...second.data].map(item => item.id)).toEqual(rows(0, 400).map(item => item.id));
    expect(requests.map(request => new URL(request.url).searchParams.get("limit")))
      .toEqual(["100", "100", "50", "100", "100"]);
    for (const request of requests) {
      const url = new URL(request.url);
      expect(url.origin).toBe("https://configured.example.test");
      expect(url.pathname).toBe("/api/0/organizations/example/issues/");
      expect(url.searchParams.get("query")).toBe("is:unresolved");
      expect(url.searchParams.has("per_page")).toBe(false);
      expect(request.headers.get("Authorization")).toBe("Bearer configured");
      expect(request.headers.get("X-Context")).toBe("pagination");
    }
    expect(options.query.limit).toBe(100);
  });

  test("respects a smaller issue page size and clamps to the verified cap", async () => {
    for (const { requested, limit, expected } of [
      { requested: 20, limit: 45, expected: [20, 20, 5] },
      { requested: 1000, limit: 250, expected: [100, 100, 50] },
    ]) {
      const sizes: number[] = [];
      const sentry = createSentryClient({
        baseUrl: "https://example.test",
        fetch: asFetch(async request => {
          const size = Number(new URL(request.url).searchParams.get("limit"));
          sizes.push(size);
          return Response.json(rows(0, size), { headers: { Link: link("next") } });
        }),
      });
      const batch = await sentry.paginateUpTo.listProjectIssues(
        { path: { ...path, project_id_or_slug: "project" }, query: { limit: requested } },
        { limit },
      );
      expect(sizes).toEqual(expected);
      expect(batch.data).toHaveLength(limit);
      expect(batch.stopReason).toBe("limit");
    }
  });

  test.each([false, true])("uses per_page for issue events, including full=%s", async full => {
    const sizes: number[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        const query = new URL(request.url).searchParams;
        expect(query.has("limit")).toBe(false);
        expect(query.get("full")).toBe(String(full));
        const size = Number(query.get("per_page"));
        sizes.push(size);
        return Response.json(rows(0, size), { headers: { Link: link("next") } });
      }),
    });
    const batch = await sentry.paginateUpTo.listOrganizationIssueEvents(
      { path: { ...path, issue_id: "1" }, query: { full } },
      { limit: 25 },
    );
    expect(sizes).toEqual(full ? [10, 10, 5] : [25]);
    expect(batch.data).toHaveLength(25);
    expect(batch.nextCursor).toBe("next");
  });

  test("keeps page size fixed for page-number cursors and suppresses a cursor past trimmed rows", async () => {
    const sizes: string[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        const query = new URL(request.url).searchParams;
        sizes.push(query.get("per_page")!);
        // Backend OffsetPaginator fixtures: changing page 3 to size 50 would
        // return 251..300 instead of 201..250 (cursor 100:2:0).
        const start = Number(query.get("cursor")?.split(":")[1] ?? 0) * 100;
        return Response.json(rows(start, 100), { headers: { Link: link(`100:${start / 100 + 1}:0`) } });
      }),
    });
    const batch = await sentry.paginateUpTo.listOrganizationProjects(
      { path, query: { per_page: 100 } }, { limit: 250 },
    );
    expect(sizes).toEqual(["100", "100", "100"]);
    expect(batch.data.map(item => item.id)).toEqual(rows(0, 250).map(item => item.id));
    expect(batch.stopReason).toBe("limit");
    expect(batch.nextCursor).toBeUndefined();
  });

  test("leaves undocumented sizing alone and reports overshoot even if JavaScript passes the removed override", async () => {
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        const query = new URL(request.url).searchParams;
        expect(query.has("per_page")).toBe(false);
        expect(query.has("limit")).toBe(false);
        return Response.json(rows(0, 3), { headers: { Link: link("past-discarded") } });
      }),
    });
    const options = { limit: 2, keepCursorOnOvershoot: true };
    const batch = await sentry.paginateUpTo.listOrganizationMembers({ path }, options);
    expect(batch.data.map(item => item.id)).toEqual(["0", "1"]);
    expect(batch.stopReason).toBe("limit");
    expect(batch.nextCursor).toBeUndefined();
  });

  test("replays the original generated page size when a server ignores it", async () => {
    const sizes: string[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        const size = new URL(request.url).searchParams.get("limit")!;
        sizes.push(size);
        return Response.json(rows(0, 3), { headers: { Link: link("past-discarded") } });
      }),
    });
    const batch = await sentry.paginateUpTo.listOrganizationIssues({ path }, { limit: 2 });
    expect(batch.data.map(item => item.id)).toEqual(["0", "1"]);
    expect(batch.stopReason).toBe("limit");
    expect(batch.nextCursor).toBeUndefined();
    const resumed = await sentry.paginateUpTo.listOrganizationIssues(
      { path }, { limit: 1, resume: batch.continuation },
    );
    expect(resumed.data.map(item => item.id)).toEqual(["2"]);
    expect(resumed.nextCursor).toBe("past-discarded");
    expect(sizes).toEqual(["2", "2"]);
  });

  test.each(["paginateAll", "paginateUpTo"] as const)("%s resumes after maxPages and rejects a later HTTP failure", async kind => {
    const requests: string[] = [];
    let fail = false;
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        const cursor = new URL(request.url).searchParams.get("cursor") ?? "0";
        requests.push(cursor);
        if (fail) return Response.json({ detail: "Unavailable" }, { status: 503 });
        return Response.json(rows(Number(cursor), 1), { headers: { Link: link(String(Number(cursor) + 1)) } });
      }),
    });
    const collect = (cursor?: string) => sentry[kind].listOrganizations({}, {
      limit: 10, maxPages: 2, startCursor: cursor,
    });
    const first = await collect();
    const second = await collect(first.nextCursor);
    expect(first.data.map(item => item.id)).toEqual(["0", "1"]);
    expect(second.data.map(item => item.id)).toEqual(["2", "3"]);
    expect(first.stopReason).toBe("maxPages");
    expect(second.stopReason).toBe("maxPages");
    expect(first.nextCursor).toBe("2");
    expect(second.nextCursor).toBe("4");
    expect(requests).toEqual(["0", "1", "2", "3"]);

    // A successful first page must not turn a subsequent error into a partial success.
    sentry.client.interceptors.response.use(response => { fail = true; return response; });
    const error = await collect(second.nextCursor).catch(error => error);
    expect(error).toBeInstanceOf(SentryApiError);
    expect(error.status).toBe(503);
    expect(requests.slice(4)).toEqual(["4", "5"]);
  });
});
