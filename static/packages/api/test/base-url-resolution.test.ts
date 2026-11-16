import { describe, expect, test } from "vitest";
import { createSentryClient, type BaseUrlRequest, type Config } from "@sentry/api";

const recordingFetch = (urls: string[]) =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(new Request(input, init).url);
    return Response.json({});
  }) as NonNullable<Config["fetch"]>;

describe("resolveBaseUrl", () => {
  test("picks the base URL from the organization an operation's path targets", async () => {
    const urls: string[] = [];
    const seen: BaseUrlRequest[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://sentry.io",
      fetch: recordingFetch(urls),
      resolveBaseUrl: async request => {
        seen.push(request);
        return "https://us.sentry.io/";
      },
    });

    await sentry.listOrganizationIssues({
      path: { organization_id_or_slug: "acme" },
      query: { query: "is:unresolved" },
    });

    expect(seen).toEqual([{
      baseUrl: "https://sentry.io",
      url: expect.stringMatching(/^\/api\/0\/organizations\/acme\/issues\/\?/),
      scope: { organization: "acme" },
    }]);
    expect(urls).toHaveLength(1);
    const url = new URL(urls[0]!);
    expect(`${url.origin}${url.pathname}`).toBe("https://us.sentry.io/api/0/organizations/acme/issues/");
    expect(url.searchParams.get("query")).toBe("is:unresolved");
  });

  test("passes the project scope and omits scope for unscoped paths", async () => {
    const seen: BaseUrlRequest[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://sentry.example.com",
      fetch: recordingFetch([]),
      resolveBaseUrl: request => {
        seen.push(request);
        return request.baseUrl;
      },
    });

    const project = await sentry.client.prepareRequest({
      method: "GET",
      url: "/projects/{org}/{project}/",
      path: { org: "acme", project: "web" },
    });
    const unscoped = await sentry.client.prepareRequest({ method: "GET", url: "/organizations/" });

    expect(seen.map(request => request.scope)).toEqual([{ organization: "acme", project: "web" }, undefined]);
    expect("scope" in seen[1]!).toBe(false);
    expect(project.url).toBe("https://sentry.example.com/api/0/projects/acme/web/");
    expect(unscoped.url).toBe("https://sentry.example.com/api/0/organizations/");
  });

  test("resolves raw request URLs, with an empty base URL when none is configured", async () => {
    const seen: BaseUrlRequest[] = [];
    const sentry = createSentryClient({
      resolveBaseUrl: request => {
        seen.push(request);
        return "https://de.sentry.io";
      },
    });

    const request = await sentry.client.prepareRequest({
      method: "POST",
      url: "/organizations/acme/releases/?existing=1",
      body: { version: "1.0.0" },
    });

    expect(seen).toEqual([{
      baseUrl: "",
      url: "/api/0/organizations/acme/releases/?existing=1",
      scope: { organization: "acme" },
    }]);
    expect(request.url).toBe("https://de.sentry.io/api/0/organizations/acme/releases/?existing=1");
  });

  test("runs after request validation and before request interceptors, once per request", async () => {
    const stages: string[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://sentry.io",
      fetch: recordingFetch([]),
      requestValidator: async () => { stages.push("validate"); },
      resolveBaseUrl: () => {
        stages.push("resolve");
        return "https://us.sentry.io";
      },
    });
    sentry.client.interceptors.request.use(request => {
      stages.push(`intercept ${new URL(request.url).host}`);
      return request;
    });

    await sentry.getOrganization({ path: { organization_id_or_slug: "acme" } });

    expect(stages).toEqual(["validate", "resolve", "intercept us.sentry.io"]);
  });

  test("a per-request resolver replaces the configured one", async () => {
    const urls: string[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://sentry.io",
      fetch: recordingFetch(urls),
      resolveBaseUrl: () => "https://us.sentry.io",
    });

    await sentry.getOrganization({
      path: { organization_id_or_slug: "acme" },
      resolveBaseUrl: () => "https://de.sentry.io",
    });

    expect(urls).toEqual(["https://de.sentry.io/api/0/organizations/acme/"]);
  });

  test("rejects the request without fetching when the resolver throws", async () => {
    const urls: string[] = [];
    const failure = new Error("no region for acme");
    const sentry = createSentryClient({
      baseUrl: "https://sentry.io",
      fetch: recordingFetch(urls),
      resolveBaseUrl: async () => { throw failure; },
    });

    await expect(sentry.getOrganization({ path: { organization_id_or_slug: "acme" } })).rejects.toBe(failure);
    expect(urls).toEqual([]);
  });
});
