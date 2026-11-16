import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RetryPolicy } from "../../src/api-client/retry.ts";
import {
  ApiTimeoutError,
  type ApiTransportOptions,
  createApiTransport,
  getValidatedResponseSource,
  type TransportCache,
  type TransportCredential,
} from "../../src/api-client/transport.ts";
import {
  buildCacheKey,
  createMemoryStore,
  lookupResponse,
  storeResponse,
} from "../../src/api-client/response-cache/index.ts";
import { createBodyCodec, waitFor } from "./support.ts";

const URL_BASE = "https://us.sentry.io/api/0";
const ISSUES_URL = `${URL_BASE}/organizations/acme/issues/`;

const policy: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 10,
  maxDelayMs: 2000,
  maxTotalDelayMs: 3000,
};

const credential: TransportCredential = { token: "token-a", identity: "id-a" };

type Sent = { method: string; url: string; headers: Headers; body: string };

/** A fetch that answers from `responses` in order and records each request. */
function scriptedFetch(
  responses: Array<Response | Error | (() => Response | Promise<Response>)>,
) {
  const sent: Sent[] = [];
  const fetch = vi.fn(
    async (input: Request | string | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      sent.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: await request.text(),
      });
      const next = responses[Math.min(sent.length, responses.length) - 1];
      if (next === undefined) {
        throw new Error("unexpected request");
      }
      if (next instanceof Error) {
        throw next;
      }
      if (typeof next === "function") {
        return await next();
      }
      // A fresh body per call: cancelling a clone's tee branch would wait for
      // the template's branch, which nothing reads.
      return new Response(
        next.body && (await next.clone().arrayBuffer()),
        next,
      );
    },
  );
  return { fetch, sent };
}

function transport(
  fetch: ApiTransportOptions<TransportCredential>["fetch"],
  overrides: Partial<ApiTransportOptions<TransportCredential>> = {},
) {
  return createApiTransport({
    credentials: { current: () => credential },
    retry: policy,
    timeoutMs: 1000,
    fetch,
    ...overrides,
  });
}

function windowLimited(resetInMs: number, now = Date.now()) {
  return new Response('{"detail":"slow down"}', {
    status: 429,
    headers: {
      "X-Sentry-Rate-Limit-Remaining": "0",
      "X-Sentry-Rate-Limit-Reset": String(Math.ceil((now + resetInMs) / 1000)),
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("credential selection", () => {
  it("passes the request URL and its org scope to the credential provider", async () => {
    const { fetch } = scriptedFetch([Response.json([])]);
    const current = vi.fn(() => credential);

    await transport(fetch, { credentials: { current } }).request(
      `${URL_BASE}/projects/acme/web/events/`,
    );

    expect(current).toHaveBeenCalledWith({
      url: `${URL_BASE}/projects/acme/web/events/`,
      scope: { organization: "acme", project: "web" },
    });
  });

  it("omits the scope for an unscoped path", async () => {
    const { fetch } = scriptedFetch([Response.json({})]);
    const current = vi.fn(() => credential);

    await transport(fetch, { credentials: { current } }).request(
      `${URL_BASE}/users/me/`,
    );

    expect(current).toHaveBeenCalledWith({ url: `${URL_BASE}/users/me/` });
  });

  it("sends the credential the provider picked for the org", async () => {
    const { fetch, sent } = scriptedFetch([Response.json([])]);
    const other: TransportCredential = { token: "token-b", identity: "id-b" };

    await transport(fetch, {
      credentials: {
        current: ({ scope }) =>
          scope?.organization === "acme" ? other : credential,
      },
    }).request(ISSUES_URL);

    expect(sent[0]?.headers.get("Authorization")).toBe("Bearer token-b");
  });
});

describe("retried statuses", () => {
  it("returns a deterministic 5xx without retrying", async () => {
    const { fetch, sent } = scriptedFetch([new Response("", { status: 501 })]);

    const response = await transport(fetch).request(ISSUES_URL);

    expect(response.status).toBe(501);
    expect(sent).toHaveLength(1);
  });

  it("retries a 503 GET with backoff", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 503 }),
      Response.json({ ok: true }),
    ]);

    const response = await transport(fetch).request(ISSUES_URL);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(2);
  });
});

describe("unused bodies", () => {
  it("retries without waiting for a teed body to cancel", async () => {
    // Interceptors such as MSW hand out one branch of a teed stream; cancelling
    // it settles only once the other branch, which nothing reads, is drained.
    const [branch] = new Response("busy").body?.tee() ?? [];
    const { fetch, sent } = scriptedFetch([
      () => new Response(branch, { status: 503 }),
      Response.json({ ok: true }),
    ]);

    const response = await transport(fetch).request(ISSUES_URL);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(2);
  });
});

describe("writes", () => {
  it("retries a rate-limited POST once the window resets", async () => {
    const { fetch, sent } = scriptedFetch([
      () => windowLimited(0),
      Response.json({ ok: true }),
    ]);

    const response = await transport(fetch).request(ISSUES_URL, {
      method: "POST",
      body: '{"a":1}',
    });

    expect(response.status).toBe(200);
    expect(sent.map((request) => request.body)).toEqual(['{"a":1}', '{"a":1}']);
  });

  it.each([
    ["a 503", new Response("", { status: 503 })],
    ["a network error", new TypeError("fetch failed")],
  ])("does not replay a POST after %s", async (_, failure) => {
    const { fetch, sent } = scriptedFetch([failure]);

    const result = await transport(fetch)
      .request(ISSUES_URL, { method: "POST", body: "{}" })
      .catch((error: unknown) => error);

    expect(result instanceof Response ? result.status : result).toEqual(
      failure instanceof Response ? 503 : failure,
    );
    expect(sent).toHaveLength(1);
  });

  it("retries a POST marked idempotent like a GET", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 503 }),
      Response.json({ ok: true }),
    ]);

    const response = await transport(fetch).request(
      ISSUES_URL,
      { method: "POST", body: "chunk" },
      { idempotent: true },
    );

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(2);
  });

  it("retries a write the host marks idempotent", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 502 }),
      new Response(null, { status: 204 }),
    ]);

    const response = await transport(fetch, {
      isIdempotent: (method) => method === "PUT",
    }).request(ISSUES_URL, { method: "PUT", body: "{}" });

    expect(response.status).toBe(204);
    expect(sent).toHaveLength(2);
  });

  it("replays a stream body on each attempt", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 503 }),
      Response.json({ ok: true }),
    ]);

    await transport(fetch).request(
      ISSUES_URL,
      {
        method: "POST",
        body: new Response("streamed").body,
        duplex: "half",
      } as RequestInit,
      { idempotent: true },
    );

    expect(sent.map((request) => request.body)).toEqual([
      "streamed",
      "streamed",
    ]);
  });
});

describe("credential refresh", () => {
  it("replays a POST once with the refreshed token", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 401 }),
      Response.json({ ok: true }),
    ]);
    const refresh = vi.fn(async (current: TransportCredential) => ({
      ...current,
      token: "token-b",
    }));

    const response = await transport(fetch, {
      credentials: { current: () => credential, refresh },
      refreshedRequestHeader: "x-refreshed",
    }).request(ISSUES_URL, { method: "POST", body: "{}" });

    expect(response.status).toBe(200);
    expect(sent.map((request) => request.headers.get("authorization"))).toEqual(
      ["Bearer token-a", "Bearer token-b"],
    );
    expect(sent[1]?.headers.get("x-refreshed")).toBe("1");
  });

  it("returns a second 401 without refreshing again", async () => {
    const { fetch, sent } = scriptedFetch([new Response("", { status: 401 })]);
    const refresh = vi.fn(async (current: TransportCredential) => current);

    const response = await transport(fetch, {
      credentials: { current: () => credential, refresh },
    }).request(ISSUES_URL);

    expect(response.status).toBe(401);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(2);
  });

  it("refreshes after a 401 with no retry budget", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 401 }),
      Response.json({ ok: true }),
    ]);
    const refresh = vi.fn(async (current: TransportCredential) => ({
      ...current,
      token: "token-b",
    }));

    const response = await transport(fetch, {
      credentials: { current: () => credential, refresh },
      retry: { ...policy, maxRetries: 0 },
    }).request(ISSUES_URL);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(2);
  });

  it("does not spend a retry on the refresh replay", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 401 }),
      new Response("", { status: 503 }),
      Response.json({ ok: true }),
    ]);
    const refresh = vi.fn(async (current: TransportCredential) => ({
      ...current,
      token: "token-b",
    }));

    const response = await transport(fetch, {
      credentials: { current: () => credential, refresh },
      retry: { ...policy, maxRetries: 1 },
    }).request(ISSUES_URL);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(3);
  });

  it("refreshes ahead of expiry before the first attempt", async () => {
    const { fetch, sent } = scriptedFetch([Response.json({})]);

    await transport(fetch, {
      credentials: {
        current: () => credential,
        prepare: async (current) => ({ ...current, token: "fresh" }),
      },
    }).request(ISSUES_URL);

    expect(sent[0]?.headers.get("authorization")).toBe("Bearer fresh");
  });
});

describe("rate-limit waits", () => {
  it("waits for a reset within the cap", async () => {
    // The reset header has whole-second resolution, so start on a second.
    vi.setSystemTime(Date.UTC(2026, 0, 1, 12, 0, 0, 0));
    const { fetch, sent } = scriptedFetch([
      () => windowLimited(1000),
      Response.json({ ok: true }),
    ]);

    const pending = transport(fetch).request(ISSUES_URL);
    await delay(900);
    expect(sent).toHaveLength(1);

    expect((await pending).status).toBe(200);
    expect(sent).toHaveLength(2);
  });

  it("does not wait for a reset beyond the cap and reports the delay", async () => {
    const { fetch, sent } = scriptedFetch([() => windowLimited(30_000)]);
    const rateLimited = vi.fn(async () => new Error("rate limited"));

    const result = await transport(fetch, { errors: { rateLimited } })
      .request(ISSUES_URL)
      .catch((error: unknown) => error);

    expect(result).toEqual(new Error("rate limited"));
    expect(sent).toHaveLength(1);
    const [, info] = rateLimited.mock.calls[0] as unknown as [
      Response,
      { path: string; retryAfterMs: number },
    ];
    expect(info.path).toBe("/api/0/organizations/acme/issues/");
    expect(info.retryAfterMs).toBeGreaterThan(28_000);
  });

  it("sends a still-limited GET at most maxRetries + 1 times", async () => {
    const { fetch, sent } = scriptedFetch([() => windowLimited(0)]);

    const response = await transport(fetch).request(ISSUES_URL);

    expect(response.status).toBe(429);
    expect(sent).toHaveLength(policy.maxRetries + 1);
  });

  it("ends the wait when the caller aborts", async () => {
    const { fetch } = scriptedFetch([() => windowLimited(1500)]);
    const controller = new AbortController();
    const reason = new Error("stop");

    const pending = transport(fetch)
      .request(ISSUES_URL, { signal: controller.signal })
      .catch((error: unknown) => error);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort(reason);

    expect(await pending).toBe(reason);
  });
});

describe("timeouts and fetch errors", () => {
  const hang = (_input: Request | string | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    });

  it("rejects an in-flight request with the caller's abort reason", async () => {
    // Like fetch, reject with the signal's reason once it aborts.
    const fetch = vi.fn(
      (_input: Request | string | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const controller = new AbortController();
    const reason = new Error("tool call cancelled");

    const pending = transport(fetch)
      .request(ISSUES_URL, { signal: controller.signal })
      .catch((error: unknown) => error);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort(reason);

    expect(await pending).toBe(reason);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws the host timeout error for a POST without retrying", async () => {
    const fetch = vi.fn(hang);

    const result = await transport(fetch, { timeoutMs: 5 })
      .request(ISSUES_URL, { method: "POST" })
      .catch((error: unknown) => error);

    expect(result).toBeInstanceOf(ApiTimeoutError);
    expect(result).toMatchObject({ timeoutMs: 5, idempotent: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a timed-out GET, then maps the error", async () => {
    const fetch = vi.fn(hang);
    const timeout = vi.fn(() => new Error("host timeout"));

    const result = await transport(fetch, {
      timeoutMs: (url) => (url.includes("/issues/") ? 5 : 1000),
      errors: { timeout },
    })
      .request(ISSUES_URL)
      .catch((error: unknown) => error);

    expect(result).toEqual(new Error("host timeout"));
    expect(timeout).toHaveBeenCalledWith({ timeoutMs: 5, idempotent: true });
    expect(fetch).toHaveBeenCalledTimes(policy.maxRetries + 1);
  });

  it("times out a buffered body that stalls after the headers", async () => {
    // Unlike fetch, this body ignores the attempt's signal once headers arrive.
    const stalled = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("{"));
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    const fetch = vi.fn(async () => stalled());

    const result = await Promise.race([
      transport(fetch, { timeoutMs: 5 })
        .request(ISSUES_URL, { method: "POST" }, { responseBody: "buffer" })
        .catch((error: unknown) => error),
      new Promise((resolve) => setTimeout(() => resolve("stalled"), 1000)),
    ]);

    expect(result).toBeInstanceOf(ApiTimeoutError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws a fatal fetch error at once", async () => {
    const { fetch, sent } = scriptedFetch([new Error("bad certificate")]);

    const result = await transport(fetch, {
      errors: { fatal: (error) => new Error("tls", { cause: error }) },
    })
      .request(ISSUES_URL)
      .catch((error: unknown) => error);

    expect(result).toEqual(
      new Error("tls", { cause: new Error("bad certificate") }),
    );
    expect(sent).toHaveLength(1);
  });

  it("does not retry an error from the host's header rules", async () => {
    const { fetch } = scriptedFetch([Response.json({})]);

    const result = await transport(fetch, {
      prepareHeaders: () => {
        throw new Error("untrusted host");
      },
    })
      .request(ISSUES_URL)
      .catch((error: unknown) => error);

    expect(result).toEqual(new Error("untrusted host"));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("headers", () => {
  it("keeps a Request's own headers and adds auth and User-Agent", async () => {
    const { fetch, sent } = scriptedFetch([Response.json({})]);

    await transport(fetch, { userAgent: "test-agent" }).request(
      new Request(ISSUES_URL, {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(Object.fromEntries(sent[0]?.headers ?? [])).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer token-a",
      "user-agent": "test-agent",
    });
  });

  it("leaves Authorization to the request without credentials", async () => {
    const { fetch, sent } = scriptedFetch([Response.json({})]);
    const api = createApiTransport({ retry: policy, fetch });

    await api.request(ISSUES_URL, {
      headers: { Authorization: "Bearer from-request" },
    });

    expect(sent[0]?.headers.get("Authorization")).toBe("Bearer from-request");
  });
});

describe("validated redirects", () => {
  const redirect = (location: string, status = 302) =>
    new Response(null, { status, headers: { location } });
  const origins = {
    trusts: (url: URL) => url.hostname.endsWith(".sentry.io"),
    reject: (destination: string) => new Error(`untrusted ${destination}`),
  };

  it("follows trusted hops and records the final origin", async () => {
    const { fetch, sent } = scriptedFetch([
      redirect("https://de.sentry.io/api/0/users/me/regions/"),
      Response.json({ regions: [] }),
    ]);

    const response = await transport(fetch, { origins }).request(
      `${URL_BASE}/users/me/regions/`,
      undefined,
      { validateRedirects: true },
    );

    expect(sent.map((request) => request.url)).toEqual([
      `${URL_BASE}/users/me/regions/`,
      "https://de.sentry.io/api/0/users/me/regions/",
    ]);
    expect(getValidatedResponseSource(response)).toEqual({
      origin: "https://de.sentry.io",
      identity: "id-a",
    });
  });

  it.each([
    [
      "an untrusted host",
      "https://evil.example/",
      "untrusted https://evil.example",
    ],
    ["a loop", `${URL_BASE}/users/me/regions/`, "untrusted <redirect loop>"],
  ])(
    "rejects %s without sending the credential",
    async (_, location, message) => {
      const { fetch, sent } = scriptedFetch([redirect(location)]);

      const result = await transport(fetch, { origins })
        .request(`${URL_BASE}/users/me/regions/`, undefined, {
          validateRedirects: true,
        })
        .catch((error: unknown) => error);

      expect(result).toEqual(new Error(message));
      expect(sent).toHaveLength(1);
    },
  );

  it("turns a 303 into a bodiless GET", async () => {
    const { fetch, sent } = scriptedFetch([
      redirect(`${URL_BASE}/done/`, 303),
      Response.json({}),
    ]);

    await transport(fetch, { origins }).request(
      ISSUES_URL,
      {
        method: "POST",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      },
      { validateRedirects: true },
    );

    expect(sent[1]).toMatchObject({ method: "GET", body: "" });
    expect(sent[1]?.headers.get("content-type")).toBeNull();
  });
});

describe("cache", () => {
  /** A cache on the shared memory store, keyed as the hosts key it. */
  function memoryCache(): TransportCache & { invalidated: string[] } {
    const store = createMemoryStore();
    const codec = createBodyCodec();
    const invalidated: string[] = [];
    return {
      invalidated,
      lookup: async ({ url, requestHeaders, identity }) =>
        await lookupResponse({
          store,
          codec,
          key: await buildCacheKey("GET", url, identity),
          url,
          requestHeaders,
        }),
      store: async ({ url, requestHeaders, identity }, response) => {
        await storeResponse({
          store,
          codec,
          key: await buildCacheKey("GET", url, identity),
          identity,
          url,
          requestHeaders,
          response,
        });
      },
      invalidate: async (url) => {
        invalidated.push(url);
      },
    };
  }

  it("serves a repeated GET from the cache", async () => {
    const cache = memoryCache();
    const { fetch, sent } = scriptedFetch([Response.json([{ id: "1" }])]);
    const api = transport(fetch, { cache });

    await (await api.request(ISSUES_URL)).json();
    await waitFor(async () =>
      expect(
        await cache.lookup({
          url: ISSUES_URL,
          requestHeaders: { authorization: "Bearer token-a" },
          identity: "id-a",
        }),
      ).toBeDefined(),
    );
    const cached = await api.request(ISSUES_URL);

    expect(await cached.json()).toEqual([{ id: "1" }]);
    expect(sent).toHaveLength(1);
  });

  it("matches Vary: Authorization with the host's Authorization", async () => {
    const cache = memoryCache();
    const { fetch, sent } = scriptedFetch([
      Response.json([{ id: "1" }], {
        headers: { "cache-control": "private, max-age=60", vary: "Authorization" },
      }),
    ]);
    const api = transport(fetch, {
      cache,
      credentials: {
        current: () => credential,
        authorization: ({ token }) => `Token ${token}`,
      },
    });

    await (await api.request(ISSUES_URL)).json();
    await waitFor(async () =>
      expect(
        await cache.lookup({
          url: ISSUES_URL,
          requestHeaders: { authorization: "Token token-a" },
          identity: "id-a",
        }),
      ).toBeDefined(),
    );
    const cached = await api.request(ISSUES_URL);

    expect(await cached.json()).toEqual([{ id: "1" }]);
    expect(sent).toHaveLength(1);
  });

  it("skips the cache in a fresh scope and replaces the entry", async () => {
    const cache = memoryCache();
    const { fetch, sent } = scriptedFetch([
      Response.json({ v: 1 }),
      Response.json({ v: 2 }),
    ]);
    let fresh = false;
    const api = transport(fetch, { cache, fresh: () => fresh });
    const stored = async (v: number) =>
      await waitFor(async () => {
        const lookup = await cache.lookup({
          url: ISSUES_URL,
          requestHeaders: { authorization: "Bearer token-a" },
          identity: "id-a",
        });
        expect(
          lookup?.kind === "hit" ? await lookup.response.json() : undefined,
        ).toEqual({ v });
      });

    await api.request(ISSUES_URL);
    await stored(1);
    fresh = true;
    expect(await (await api.request(ISSUES_URL)).json()).toEqual({ v: 2 });
    await stored(2);
    fresh = false;

    expect(await (await api.request(ISSUES_URL)).json()).toEqual({ v: 2 });
    expect(sent).toHaveLength(2);
  });

  it("is not consulted without credentials", async () => {
    const lookup = vi.fn();
    const store = vi.fn();
    const { fetch, sent } = scriptedFetch([Response.json({})]);
    const api = createApiTransport({
      retry: policy,
      fetch,
      cache: { lookup, store, invalidate: vi.fn() },
    });

    await (await api.request(ISSUES_URL)).json();
    await (await api.request(ISSUES_URL)).json();

    expect(sent).toHaveLength(2);
    expect(lookup).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it("revalidates a stale entry with its ETag", async () => {
    const response = await transport(
      scriptedFetch([new Response(null, { status: 304 })]).fetch,
      {
        cache: {
          lookup: async () => ({
            kind: "stale",
            conditionalHeaders: { "If-None-Match": '"v1"' },
            revalidate: async () => Response.json({ cached: true }),
          }),
          store: async () => {},
          invalidate: async () => {},
        },
      },
    ).request(ISSUES_URL);

    expect(await response.json()).toEqual({ cached: true });
  });

  it("invalidates after a successful write", async () => {
    const cache = memoryCache();
    const { fetch } = scriptedFetch([new Response(null, { status: 204 })]);

    await transport(fetch, { cache }).request(`${ISSUES_URL}1/`, {
      method: "PUT",
    });

    expect(cache.invalidated).toEqual([`${ISSUES_URL}1/`]);
  });
});
