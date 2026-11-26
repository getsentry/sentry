import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiTimeoutError,
  type ApiTransportOptions,
  type CachedRequest,
  createApiTransport,
  getValidatedResponseSource,
  type TransportCache,
  type TransportCredential,
} from "../../src/api-client/transport.ts";
import { waitFor } from "./support.ts";

const URL_BASE = "https://us.sentry.io/api/0";
const ISSUES_URL = `${URL_BASE}/organizations/acme/issues/`;

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

describe("sends once", () => {
  it.each([
    ["a 503", () => new Response("", { status: 503 }), 503],
    ["a rate-limited 429", () => windowLimited(0), 429],
  ])("returns %s without retrying", async (_, failure, status) => {
    const { fetch, sent } = scriptedFetch([failure, Response.json({})]);

    const response = await transport(fetch).request(ISSUES_URL);

    expect(response.status).toBe(status);
    expect(sent).toHaveLength(1);
  });

  it("throws a network error without retrying", async () => {
    const { fetch, sent } = scriptedFetch([
      new TypeError("fetch failed"),
      Response.json({}),
    ]);

    const result = await transport(fetch)
      .request(ISSUES_URL)
      .catch((error: unknown) => error);

    expect(result).toEqual(new TypeError("fetch failed"));
    expect(sent).toHaveLength(1);
  });
});

describe("credential refresh", () => {
  const refreshToB = () =>
    vi.fn(async (current: TransportCredential) => ({
      ...current,
      token: "token-b",
    }));

  it("replays a POST once with the refreshed token", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 401 }),
      Response.json({ ok: true }),
    ]);

    const response = await transport(fetch, {
      credentials: { current: () => credential, refresh: refreshToB() },
      refreshedRequestHeader: "x-refreshed",
    }).request(ISSUES_URL, { method: "POST", body: "{}" });

    expect(response.status).toBe(200);
    expect(sent.map((request) => request.headers.get("authorization"))).toEqual(
      ["Bearer token-a", "Bearer token-b"],
    );
    expect(sent[1]?.headers.get("x-refreshed")).toBe("1");
  });

  it("replays a stream body after the refresh", async () => {
    const { fetch, sent } = scriptedFetch([
      new Response("", { status: 401 }),
      Response.json({ ok: true }),
    ]);

    await transport(fetch, {
      credentials: { current: () => credential, refresh: refreshToB() },
    }).request(ISSUES_URL, {
      method: "POST",
      body: new Response("streamed").body,
      duplex: "half",
    } as RequestInit);

    expect(sent.map((request) => request.body)).toEqual([
      "streamed",
      "streamed",
    ]);
  });

  it("replays without waiting for a teed body to cancel", async () => {
    // Interceptors such as MSW hand out one branch of a teed stream; cancelling
    // it settles only once the other branch, which nothing reads, is drained.
    const [branch] = new Response("expired").body?.tee() ?? [];
    const { fetch, sent } = scriptedFetch([
      () => new Response(branch, { status: 401 }),
      Response.json({ ok: true }),
    ]);

    const response = await transport(fetch, {
      credentials: { current: () => credential, refresh: refreshToB() },
    }).request(ISSUES_URL);

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(2);
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

describe("rate limits", () => {
  it("reports the server's delay to the host error", async () => {
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

  it("throws the host timeout error for a POST", async () => {
    const fetch = vi.fn(hang);

    const result = await transport(fetch, { timeoutMs: 5 })
      .request(ISSUES_URL, { method: "POST" })
      .catch((error: unknown) => error);

    expect(result).toBeInstanceOf(ApiTimeoutError);
    expect(result).toMatchObject({ timeoutMs: 5, idempotent: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("maps a timed-out GET with the host error", async () => {
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
    expect(fetch).toHaveBeenCalledTimes(1);
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

  it("throws an error from the host's header rules before sending", async () => {
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
    const api = createApiTransport({ fetch });

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
  /**
   * A cache that keys entries by identity, URL, and Authorization, so a hit
   * needs the transport to pass the same Authorization to lookup and store.
   */
  function memoryCache(): TransportCache & { invalidated: string[] } {
    const entries = new Map<string, { body: ArrayBuffer; init: ResponseInit }>();
    const invalidated: string[] = [];
    const key = ({ url, requestHeaders, identity }: CachedRequest) =>
      JSON.stringify([identity, url, requestHeaders.authorization ?? ""]);
    return {
      invalidated,
      lookup: async (request) => {
        const entry = entries.get(key(request));
        return (
          entry && {
            kind: "hit",
            response: new Response(entry.body.slice(0), entry.init),
          }
        );
      },
      store: async (request, response) => {
        entries.set(key(request), {
          body: await response.arrayBuffer(),
          init: { status: response.status, headers: response.headers },
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

  it("looks up and stores with the host's Authorization", async () => {
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
