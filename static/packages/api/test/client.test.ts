import { describe, expect, test } from "vitest";
import {
  createSentryClient,
  listOrganizations,
  narrowError_getProject,
  paginateAll_listOrganizations,
  SentryApiError,
  type Config,
} from "@sentry/api";
import * as operations from "../src/sdk.gen";

// Test handlers take a Request; adapt them to the fetch signature in Config.
const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(new Request(input, init))) as NonNullable<Config["fetch"]>;

describe("configured operation methods", () => {
  test("streams typed events through the published transport with auth and request interceptors", async () => {
    const requests: Request[] = [];
    const callbacks: string[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test/prefix",
      auth: () => "stream-token",
      fetch: asFetch(async request => {
        requests.push(request);
        return new Response('data: "first"\n\ndata: "second"\n\n', {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    });
    sentry.client.interceptors.request.use(request => {
      request.headers.set("X-Context", "stream");
      return request;
    });
    const { stream } = await sentry.client.sse.get<string>({
      url: "/events/",
      security: [{ type: "http", scheme: "bearer" }],
      onSseEvent: event => { callbacks.push(event.data.toUpperCase()); },
    });
    const values: string[] = [];
    for await (const value of stream) values.push(value);

    expect(values).toEqual(["first", "second"]);
    expect(callbacks).toEqual(["FIRST", "SECOND"]);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("https://example.test/prefix/api/0/events/");
    expect(requests[0]!.headers.get("Authorization")).toBe("Bearer stream-token");
    expect(requests[0]!.headers.get("X-Context")).toBe("stream");
  });

  test("exposes every generated operation through the public package", () => {
    const sentry = createSentryClient();
    const { client, fetchPage, paginateAll, paginateUpTo, ...methods } = sentry;

    expect(Object.keys(methods).sort()).toEqual(Object.keys(operations).sort());
    expect(Object.values(methods).every(method => typeof method === "function")).toBe(true);
    expect(client).toBeDefined();
  });

  test("isolates concurrent clients and keeps extracted methods bound after reconfiguration", async () => {
    const requests: Request[] = [];
    const fetch = asFetch(async request => {
      requests.push(request);
      return Response.json([]);
    });
    const first = createSentryClient({
      baseUrl: "https://first.example.test",
      headers: { Authorization: "Bearer first" },
      fetch,
    });
    const second = createSentryClient({
      baseUrl: "https://second.example.test",
      headers: { Authorization: "Bearer second" },
      fetch,
    });
    first.client.interceptors.request.use(request => {
      request.headers.set("X-Context", "first");
      return request;
    });

    await Promise.all([first.listOrganizations(), second.listOrganizations()]);
    const { listOrganizations: detached } = first;
    first.client.setConfig({ headers: { Authorization: "Bearer refreshed" } });
    await detached();
    await second.listOrganizations();

    const observed = requests.map(request => [
      request.url,
      request.headers.get("Authorization"),
      request.headers.get("X-Context"),
    ]);
    // Interceptors can change which concurrent request reaches fetch first.
    expect(observed.slice(0, 2).sort()).toEqual([
      ["https://first.example.test/api/0/organizations/", "Bearer first", "first"],
      ["https://second.example.test/api/0/organizations/", "Bearer second", null],
    ]);
    expect(observed.slice(2)).toEqual([
      ["https://first.example.test/api/0/organizations/", "Bearer refreshed", "first"],
      ["https://second.example.test/api/0/organizations/", "Bearer second", null],
    ]);
  });

  test("delegates optional arguments, required paths, and mutation serialization", async () => {
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        requests.push(request);
        return Response.json({ slug: "example", title: "Overview" });
      }),
    });
    const options = {
      path: { organization_id_or_slug: "example" },
      body: { title: "Overview" },
    };

    await sentry.listOrganizations();
    const organization = await sentry.getOrganization({ path: options.path });
    await sentry.createOrganizationDashboard(options);

    expect(organization.data?.slug).toBe("example");
    expect(requests.map(request => [request.method, request.url])).toEqual([
      ["GET", "https://example.test/api/0/organizations/"],
      ["GET", "https://example.test/api/0/organizations/example/"],
      ["POST", "https://example.test/api/0/organizations/example/dashboards/"],
    ]);
    expect(requests[2]!.headers.get("Content-Type")).toBe("application/json");
    expect(await requests[2]!.json()).toEqual({ title: "Overview" });
    expect(options).toEqual({
      path: { organization_id_or_slug: "example" },
      body: { title: "Overview" },
    });
  });

  test("keeps per-call transport, host, and header overrides out of instance configuration", async () => {
    const requests: Array<[string, string, string | null]> = [];
    const capture = (transport: string) => asFetch(async request => {
      requests.push([transport, request.url, request.headers.get("Authorization")]);
      return Response.json([]);
    });
    const sentry = createSentryClient({
      baseUrl: "https://configured.example.test",
      headers: { Authorization: "Bearer configured" },
      fetch: capture("configured"),
    });

    await sentry.listOrganizations({
      baseUrl: "https://override.example.test",
      headers: { Authorization: "Bearer override" },
      fetch: capture("override"),
    });
    await sentry.listOrganizations();

    expect(requests).toEqual([
      ["override", "https://override.example.test/api/0/organizations/", "Bearer override"],
      ["configured", "https://configured.example.test/api/0/organizations/", "Bearer configured"],
    ]);
  });

  test("keeps the bound transport authoritative even for options carrying another client", async () => {
    const requests: string[] = [];
    const fetch = asFetch(async request => {
      requests.push(request.url);
      return Response.json([]);
    });
    const sentry = createSentryClient({ baseUrl: "https://bound.example.test", fetch });
    const other = createSentryClient({ baseUrl: "https://other.example.test", fetch });
    // Structural typing or JavaScript can pass extra fields despite the public
    // signature omitting client. They must not redirect a bound operation.
    const options = { client: other.client, query: { owner: true } };

    await sentry.listOrganizations(options);

    expect(requests).toEqual(["https://bound.example.test/api/0/organizations/?owner=true"]);
    expect(options.client).toBe(other.client);
  });

  test("forwards metadata and cancellation and preserves response headers", async () => {
    const controller = new AbortController();
    const requests: Request[] = [];
    let interceptedMetadata: unknown;
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        requests.push(request);
        return Response.json([], { headers: { "X-Sentry-Direct-Hit": "1" } });
      }),
    });
    sentry.client.interceptors.request.use((request, options) => {
      // Generated interceptor options currently omit the operation's meta type.
      interceptedMetadata = Reflect.get(options, "meta");
      return request;
    });
    const meta = { source: "test" };

    const result = await sentry.listOrganizations({ meta, signal: controller.signal });
    controller.abort();

    expect(interceptedMetadata).toBe(meta);
    expect(requests[0]!.signal.aborted).toBe(true);
    expect(result.response?.headers.get("X-Sentry-Direct-Hit")).toBe("1");
  });

  test("preserves returning and throwing error policies", async () => {
    const error = { detail: "Invalid credentials" };
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => Response.json(error, { status: 401 })),
    });

    const result = await sentry.listOrganizations();
    expect(result.error).toBeInstanceOf(SentryApiError);
    if (!(result.error instanceof SentryApiError)) throw result.error;
    expect(result.error.body).toEqual(error);
    expect(result.response?.status).toBe(401);
    await expect(sentry.listOrganizations({ throwOnError: true })).rejects.toMatchObject({
      name: "SentryApiError", status: 401, body: error,
    });

    sentry.client.setConfig({ throwOnError: true });
    const returning = await sentry.listOrganizations({ throwOnError: false });
    expect(returning.error).toBeInstanceOf(SentryApiError);
    if (!(returning.error instanceof SentryApiError)) throw returning.error;
    expect(returning.error.body).toEqual(error);
  });

  test("shares its raw client with existing named operations and helpers", async () => {
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      headers: { Authorization: "Bearer configured" },
      fetch: asFetch(async request => {
        requests.push(request);
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/0/projects/")) {
          return Response.json({ detail: "Forbidden" }, { status: 403 });
        }
        return url.searchParams.has("cursor")
          ? Response.json([{ slug: "second" }])
          : Response.json([{ slug: "first" }], {
            headers: {
              Link: '<https://example.test/api/0/organizations/?cursor=next>; rel="next"; results="true"; cursor="next"',
            },
          });
      }),
    });

    const named = await listOrganizations({ client: sentry.client });
    const all = await paginateAll_listOrganizations({ client: sentry.client });
    const narrowed = await narrowError_getProject({
      client: sentry.client,
      path: { organization_id_or_slug: "example", project_id_or_slug: "project" },
    });

    expect(named.data?.map(organization => organization.slug)).toEqual(["first"]);
    expect(all.data.map(organization => organization.slug)).toEqual(["first", "second"]);
    expect(narrowed.ok).toBe(false);
    if (!narrowed.ok) {
      expect(narrowed.error).toBeInstanceOf(SentryApiError);
      expect(narrowed.error.status).toBe(403);
    }
    expect(requests).toHaveLength(4);
    expect(requests.every(request => request.headers.get("Authorization") === "Bearer configured")).toBe(true);
    expect(requests.every(request => new URL(request.url).origin === "https://example.test")).toBe(true);
  });
});
