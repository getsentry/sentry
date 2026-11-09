import { describe, expect, test } from "vitest";
import { createSentryClient, type Config } from "@sentry/api";
import { createBrowserSdkConfig } from "@sentry/api/browser";

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(new Request(input, init))) as NonNullable<Config["fetch"]>;
const snapshot = async (request: Request) => {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => { headers[name] = value; });
  return { url: request.url, method: request.method, headers, body: await request.clone().text() };
};

describe("request preparation", () => {
  test("shares request preparation with dispatch, running configured hooks once without fetching", async () => {
    const stages: string[] = [];
    const requests: Request[] = [];
    const transport = asFetch(async request => {
      requests.push(request);
      return Response.json({ accepted: true });
    });
    const sentry = createSentryClient({
      baseUrl: "https://example.test/sentry",
      headers: { "X-Default": "default", "X-Override": "original" },
      auth: async () => { stages.push("auth"); return "test-token"; },
      requestValidator: async () => { stages.push("validate"); },
      bodySerializer: body => { stages.push("serialize"); return JSON.stringify(body); },
      fetch: transport,
    });
    sentry.client.interceptors.request.use(request => {
      stages.push("intercept");
      request.headers.set("X-Prepared", "yes");
      return request;
    });
    const options = {
      method: "POST" as const,
      url: "/api/0/organizations/{org}/items/",
      path: { org: "example" },
      body: { title: "Overview" },
      headers: { "x-override": "per-call" },
      security: [{ type: "http" as const, scheme: "bearer" as const }],
    };
    const prepared = await sentry.client.prepareRequest(options);
    expect(stages).toEqual(["auth", "validate", "serialize", "intercept"]);
    expect(requests).toHaveLength(0);
    const preview = await snapshot(prepared);
    expect(prepared.headers.get("Authorization")).toBe("Bearer test-token");
    expect(prepared.headers.get("X-Default")).toBe("default");
    expect(prepared.headers.get("X-Override")).toBe("per-call");
    expect(await (await transport(prepared)).json()).toEqual({ accepted: true });
    const result = await sentry.client.request(options);

    expect(result.data).toEqual({ accepted: true });
    expect(stages).toEqual(["auth", "validate", "serialize", "intercept", "auth", "validate", "serialize", "intercept"]);
    expect(await snapshot(requests[0]!)).toEqual(preview);
    expect(await snapshot(requests[1]!)).toEqual(preview);
    expect(options.body).toEqual({ title: "Overview" });
    const configuredHeaders = sentry.client.getConfig().headers;
    if (!(configuredHeaders instanceof Headers)) throw new Error("Expected resolved headers");
    expect(configuredHeaders.get("X-Override")).toBe("original");
  });

  test("composes with browser transport without owning its CSRF or raw response handling", async () => {
    const previousFetch = globalThis.fetch;
    const requests: Request[] = [];
    const response = Response.json({ data: [], meta: { fields: {} } }, { status: 403 });
    globalThis.fetch = asFetch(async request => { requests.push(request); return response; });
    try {
      const config = createBrowserSdkConfig({ baseUrl: "https://example.test", getCsrfToken: () => "csrf-example" });
      const sentry = createSentryClient({ ...config, fetch: asFetch(request => config.fetch(request)) });
      const prepared = await sentry.client.prepareRequest({ method: "POST", url: "/api/0/custom/", body: { value: 1 } });
      expect(requests).toHaveLength(0);
      expect(prepared.headers.has("X-CSRFToken")).toBe(false);
      const raw = await config.fetch(prepared);
      expect(raw).toBe(response);
      expect(raw.bodyUsed).toBe(false);
      expect(requests[0]!.headers.get("X-CSRFToken")).toBe("csrf-example");
      expect(requests[0]!.credentials).toBe("include");
      expect(raw.status).toBe(403);
      expect(await raw.json()).toEqual({ data: [], meta: { fields: {} } });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  test("replaces an opaque cursor without losing repeated filters, prefixes or encoded path segments", async () => {
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test/sentry/",
      fetch: asFetch(async request => { requests.push(request); return Response.json([]); }),
    });
    const options = {
      method: "GET" as const,
      url: "/api/0/items/a%2Fb/?cursor=old&cursor=older&field=id&field=name&?cursor=unrelated&query=a%20b#ignored",
      query: { cursor: "opaque/+?=#", per_page: 25 },
    };
    const request = await sentry.client.prepareRequest(options);
    const url = new URL(request.url);
    expect(url.pathname).toBe("/sentry/api/0/items/a%2Fb/");
    expect(url.searchParams.getAll("cursor")).toEqual(["opaque/+?=#"]);
    expect(url.searchParams.get("?cursor")).toBe("unrelated");
    expect(url.searchParams.getAll("field")).toEqual(["id", "name"]);
    expect(url.searchParams.get("per_page")).toBe("25");
    expect(url.search).toContain("query=a%20b");
    expect(url.hash).toBe("");
    await sentry.client.request(options);
    expect(requests[0]!.url).toBe(request.url);
    expect(options.url).toContain("cursor=old&cursor=older");
  });

  test("clears a cursor for the first page while leaving unspecified query parameters intact", async () => {
    const sentry = createSentryClient({ baseUrl: "https://example.test" });
    const request = await sentry.client.prepareRequest({
      method: "GET", url: "/api/0/items/?cursor=one&cursor=two&per_page=25&field=id&field=name",
      query: { cursor: null, per_page: undefined },
    });
    const query = new URL(request.url).searchParams;
    expect(query.has("cursor")).toBe(false);
    expect(query.get("per_page")).toBe("25");
    expect(query.getAll("field")).toEqual(["id", "name"]);
  });

  test("retains a custom serializer's bytes when overlaying an existing query", async () => {
    const sentry = createSentryClient({ baseUrl: "https://example.test" });
    const request = await sentry.client.prepareRequest({
      method: "GET", url: "/api/0/items/?cursor=old&field=old&%3Fcursor=old&query=a%20b",
      query: { cursor: "custom/cursor value", field: ["id", "name"] },
      querySerializer: () => "??cursor=literal&cursor=custom%2fcursor+value&field=id&field=name",
    });
    expect(request.url).toBe("https://example.test/api/0/items/?query=a%20b&?cursor=literal&cursor=custom%2fcursor+value&field=id&field=name");
  });

  test("supports native raw and multipart bodies without JSON serialization", async () => {
    const sentry = createSentryClient({ baseUrl: "https://example.test" });
    const raw = await sentry.client.prepareRequest({
      method: "POST", url: "/api/0/custom/", body: "raw payload", bodySerializer: null,
      headers: { "Content-Type": "text/custom" },
    });
    expect(raw.headers.get("Content-Type")).toBe("text/custom");
    expect(await raw.text()).toBe("raw payload");
    const form = new FormData();
    form.append("tag", "one");
    form.append("tag", "two");
    const multipart = await sentry.client.prepareRequest({
      method: "POST", url: "/api/0/upload/", body: form, bodySerializer: null,
      headers: { "Content-Type": null },
    });
    expect(multipart.headers.get("Content-Type")).toMatch(/^multipart\/form-data; boundary=/);
    expect((await multipart.formData()).getAll("tag")).toEqual(["one", "two"]);
  });

  test("preserves an aborted signal and its reason without dispatching", async () => {
    const controller = new AbortController();
    const reason = new Error("Caller stopped the request");
    controller.abort(reason);
    let calls = 0;
    const sentry = createSentryClient({ baseUrl: "https://example.test", fetch: asFetch(async () => { calls++; return new Response(); }) });
    const request = await sentry.client.prepareRequest({ method: "GET", url: "/api/0/items/", signal: controller.signal });
    expect(request.signal.aborted).toBe(true);
    expect(request.signal.reason).toBe(reason);
    expect(() => request.signal.throwIfAborted()).toThrow(reason);
    expect(calls).toBe(0);
  });

  test("isolates concurrent clients and keeps prepared requests unchanged after reconfiguration", async () => {
    const first = createSentryClient({ baseUrl: "https://first.example.test", headers: { "X-Context": "first" } });
    const second = createSentryClient({ baseUrl: "https://second.example.test", headers: { "X-Context": "second" } });
    const { prepareRequest } = first.client;
    const options = { method: "POST" as const, url: "/api/0/items/", body: { value: "original" } };
    const [prepared, other] = await Promise.all([prepareRequest(options), second.client.prepareRequest(options)]);
    first.client.setConfig({ baseUrl: "https://changed.example.test", headers: { "X-Context": "changed" } });
    options.body.value = "edited";
    const next = await prepareRequest(options);

    expect([prepared.url, other.url, next.url]).toEqual([
      "https://first.example.test/api/0/items/", "https://second.example.test/api/0/items/", "https://changed.example.test/api/0/items/",
    ]);
    expect([prepared, other, next].map(request => request.headers.get("X-Context"))).toEqual(["first", "second", "changed"]);
    expect(await prepared.json()).toEqual({ value: "original" });
    expect(await next.json()).toEqual({ value: "edited" });
  });
});
