import { describe, expect, test } from "vitest";
import {
  createSentryClient,
  fetchPage_listOrganizations,
  SentryApiError,
  type Config,
} from "@sentry/api";
import * as pagination from "../src/pagination.gen";

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(new Request(input, init))) as NonNullable<Config["fetch"]>;

// A Link's URL must never replace the configured operation's host or filters.
const link = (rel: "next" | "previous", cursor: string, results = true) =>
  `<https://unrelated.example.test/?cursor=${cursor}>; rel="${rel}"; results="${results}"; cursor="${cursor}"`;

describe("configured pagination methods", () => {
  test("exposes exactly the generated helpers in each namespace", () => {
    const sentry = createSentryClient();
    for (const kind of ["fetchPage", "paginateAll", "paginateUpTo"] as const) {
      const prefix = `${kind}_`;
      const names = Object.keys(pagination)
        .filter(name => name.startsWith(prefix))
        .map(name => name.slice(prefix.length));
      expect(Object.keys(sentry[kind]).sort()).toEqual(names.sort());
      expect(Object.values(sentry[kind]).every(method => typeof method === "function")).toBe(true);
    }
  });

  test("navigates first, next and previous pages with the configured request and response metadata", async () => {
    const requests: Request[] = [];
    const responses: Response[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://configured.example.test",
      headers: { Authorization: "Bearer configured" },
      fetch: asFetch(async request => {
        requests.push(request);
        const cursor = new URL(request.url).searchParams.get("cursor");
        const second = cursor === "opaque:next:0";
        const response = Response.json([{ slug: second ? "second" : "first" }], {
          headers: {
            Link: [
              link("previous", "opaque:previous:1", second),
              link("next", "opaque:next:0", !second),
            ].join(", "),
            "X-Hits": "2",
          },
        });
        responses.push(response);
        return response;
      }),
    });
    const options = { query: { owner: true, per_page: 1 } };

    const first = await sentry.fetchPage.listOrganizations(options);
    const second = await sentry.fetchPage.listOrganizations(options, first.nextCursor);
    const previous = await sentry.fetchPage.listOrganizations(options, second.prevCursor);

    expect(first.data.map(item => item.slug)).toEqual(["first"]);
    expect(first.prevCursor).toBeUndefined();
    expect(second.data.map(item => item.slug)).toEqual(["second"]);
    expect(second.nextCursor).toBeUndefined();
    expect(previous.data).toEqual(first.data);
    expect(first.response).toBe(responses[0]!);
    expect(second.response).toBe(responses[1]!);
    expect(first.response.headers.get("X-Hits")).toBe("2");
    expect(first.response.headers.get("Link")).toContain('results="false"');
    expect(first.response.bodyUsed).toBe(true);
    expect(requests.map(request => new URL(request.url).searchParams.get("cursor")))
      .toEqual([null, "opaque:next:0", "opaque:previous:1"]);
    for (const request of requests) {
      const url = new URL(request.url);
      expect(url.origin).toBe("https://configured.example.test");
      expect(url.pathname).toBe("/api/0/organizations/");
      expect(url.searchParams.get("owner")).toBe("true");
      expect(url.searchParams.get("per_page")).toBe("1");
      expect(request.headers.get("Authorization")).toBe("Bearer configured");
    }
    expect(options).toEqual({ query: { owner: true, per_page: 1 } });
  });

  test("shares configuration across detached helpers while keeping concurrent clients isolated", async () => {
    const requests: Request[] = [];
    const fetch = asFetch(async request => {
      requests.push(request);
      const url = new URL(request.url);
      const next = url.searchParams.has("cursor");
      return Response.json([{ slug: next ? "second" : "first" }], {
        headers: next ? {} : { Link: link("next", "resume:0:0") },
      });
    });
    const first = createSentryClient({ baseUrl: "https://first.example.test", fetch });
    const second = createSentryClient({ baseUrl: "https://second.example.test", fetch });
    const { listOrganizations: all } = first.paginateAll;
    const { listOrganizations: upTo } = second.paginateUpTo;
    first.client.setConfig({ headers: { Authorization: "Bearer refreshed" } });
    first.client.interceptors.request.use(request => {
      request.headers.set("X-Context", "first");
      return request;
    });
    // JavaScript and structural types can carry an extra client field.
    const options = { client: second.client, query: { owner: true } };
    const [items, batch] = await Promise.all([
      all(options),
      upTo({}, { limit: 1, startCursor: "resume:0:0" }),
    ]);
    const standalone = await fetchPage_listOrganizations({ client: first.client });

    expect(items.data.map(item => item.slug)).toEqual(["first", "second"]);
    expect(batch.data.map(item => item.slug)).toEqual(["second"]);
    expect(batch.nextCursor).toBeUndefined();
    expect(standalone.data.map(item => item.slug)).toEqual(["first"]);
    expect(standalone.response.status).toBe(200);
    expect(requests.filter(request => new URL(request.url).hostname === "first.example.test"))
      .toHaveLength(3);
    for (const request of requests) {
      const isFirst = new URL(request.url).hostname === "first.example.test";
      expect(request.headers.get("Authorization")).toBe(isFirst ? "Bearer refreshed" : null);
      expect(request.headers.get("X-Context")).toBe(isFirst ? "first" : null);
    }
    expect(options.client).toBe(second.client);
  });

  test("preserves compound page bodies and their headers without inventing collection helpers", async () => {
    const body = { data: [{ node_id: 1, timestamp: "2026-01-01T00:00:00Z" }] };
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => Response.json(body, { headers: { "X-Hits": "1" } })),
    });
    const page = await sentry.fetchPage.listProjectReplayClicks({
      path: {
        organization_id_or_slug: "example",
        project_id_or_slug: "project",
        replay_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    expect(page.data).toEqual(body);
    expect(page.response.headers.get("X-Hits")).toBe("1");
    expect("listProjectReplayClicks" in sentry.paginateAll).toBe(false);
    expect("listProjectReplayClicks" in sentry.paginateUpTo).toBe(false);
  });

  test("preserves normalized HTTP errors for page and collection helpers", async () => {
    const body = { detail: "Forbidden" };
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => Response.json(body, { status: 403 })),
    });
    for (const call of [
      () => sentry.fetchPage.listOrganizations({}),
      () => sentry.paginateAll.listOrganizations({}),
      () => sentry.paginateUpTo.listOrganizations({}, { limit: 1 }),
    ]) {
      const error = await call().catch(error => error);
      expect(error).toBeInstanceOf(SentryApiError);
      expect(error.status).toBe(403);
      expect(error.body).toEqual(body);
      expect(error.response.status).toBe(403);
    }
    sentry.client.setConfig({ throwOnError: true });
    await expect(sentry.fetchPage.listOrganizations({})).rejects.toMatchObject({
      name: "SentryApiError", status: 403, body,
    });
  });

  test("stops the next collection dispatch after cancellation", async () => {
    const controller = new AbortController();
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        requests.push(request);
        request.signal.throwIfAborted();
        controller.abort();
        return Response.json([{ slug: "first" }], { headers: { Link: link("next", "next") } });
      }),
    });

    const error = await sentry.paginateAll.listOrganizations({ signal: controller.signal })
      .catch(error => error);

    expect(error).toBe(controller.signal.reason);
    expect(error.name).toBe("AbortError");
    expect(requests).toHaveLength(1);
    expect(requests.every(request => request.signal.aborted)).toBe(true);
  });

  test("stops bounded pagination when the progress callback cancels", async () => {
    const controller = new AbortController();
    const reason = new Error("Stopped after the first page");
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        requests.push(request);
        return Response.json([{ slug: "first" }], { headers: { Link: link("next", "next") } });
      }),
    });

    const error = await sentry.paginateUpTo.listOrganizations(
      { signal: controller.signal },
      { limit: 2, onPage: () => controller.abort(reason) },
    ).catch(error => error);

    expect(error).toBe(reason);
    expect(requests).toHaveLength(1);
  });
});
