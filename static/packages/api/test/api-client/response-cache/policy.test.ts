import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createBodyCodec, waitFor } from "../support.ts";
import { createMemoryStore } from "../../../src/api-client/response-cache/memory-store.ts";
import {
  type CacheLookup,
  lookupResponse,
  REVALIDATION_WINDOW_MS,
  storeResponse,
} from "../../../src/api-client/response-cache/policy.ts";
import type { CacheEntry, CacheStore } from "../../../src/api-client/response-cache/store.ts";
import { FALLBACK_TTL_MS } from "../../../src/api-client/response-cache/tiers.ts";

const API = "https://us.sentry.io/api/0";
const STABLE_URL = `${API}/organizations/acme/projects/`;
const VOLATILE_URL = `${API}/organizations/acme/issues/`;
const NO_CACHE_URL = `${API}/organizations/acme/issues/1/autofix/`;
const IDENTITY = "identity-a";
const KEY = "key-a";
const MINUTE = 60_000;
const BODY = { data: [{ id: 1, slug: "frontend" }] };

const codec = createBodyCodec();

function json(
  body: unknown,
  headers: Record<string, string> = {},
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function notModified(headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 304, headers });
}

async function store(
  cache: CacheStore,
  response: Response,
  url = STABLE_URL,
): Promise<number> {
  return await storeResponse({
    store: cache,
    codec,
    key: KEY,
    identity: IDENTITY,
    url,
    requestHeaders: {},
    response,
  });
}

async function lookup(
  cache: CacheStore,
  url = STABLE_URL,
): Promise<CacheLookup | undefined> {
  return await lookupResponse({
    store: cache,
    codec,
    key: KEY,
    url,
    requestHeaders: {},
  });
}

/**
 * `cache`, but keeping every entry for an hour, so the policy rather than
 * the store's expiry decides freshness.
 */
function longLived(cache: CacheStore): CacheStore {
  return { ...cache, set: (key, entry) => cache.set(key, entry, 60 * MINUTE) };
}

/** A memory store that records the TTL of every `set`. */
function recordingStore(): CacheStore & { ttls: number[] } {
  const inner = createMemoryStore();
  const ttls: number[] = [];
  return {
    ttls,
    get: (key) => inner.get(key),
    set: (key, entry, ttlMs) => {
      ttls.push(ttlMs);
      return inner.set(key, entry, ttlMs);
    },
    deleteMatching: (identity, prefix) =>
      inner.deleteMatching(identity, prefix),
  };
}

function expectStale(
  result: CacheLookup | undefined,
): Extract<CacheLookup, { kind: "stale" }> {
  if (result?.kind !== "stale") {
    throw new Error(`expected a stale lookup, got ${result?.kind}`);
  }
  return result;
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("storeResponse", () => {
  it("stores a JSON response that a hit serves back", async () => {
    const cache = createMemoryStore();
    const link = `<${STABLE_URL}?cursor=0:100:0>; rel="next"`;
    const size = await store(cache, json(BODY, { link, "x-other": "dropped" }));
    expect(size).toBeGreaterThan(0);

    const result = await lookup(cache);
    expect(result?.kind).toBe("hit");
    if (result?.kind !== "hit") {
      return;
    }
    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual(BODY);
    expect(result.response.headers.get("link")).toBe(link);
    expect(result.createdAt).toBe(Date.now());
    expect(result.size).toBe(JSON.stringify(BODY).length);

    const entry = (await cache.get(KEY)) as CacheEntry;
    expect(entry).toMatchObject({
      url: STABLE_URL,
      identity: IDENTITY,
      tier: "stable",
      headers: { link },
    });
  });

  it("never persists the authorization token, and still varies on it", async () => {
    const cache = createMemoryStore();
    const token = "Bearer sntrys_secret-token";
    const withToken = (authorization: string) => ({
      store: cache,
      codec,
      key: KEY,
      url: STABLE_URL,
      requestHeaders: { authorization },
    });
    await storeResponse({
      ...withToken(token),
      identity: IDENTITY,
      response: json(BODY, {
        "cache-control": "private, max-age=60",
        vary: "Authorization",
      }),
    });

    const entry = (await cache.get(KEY)) as CacheEntry;
    expect(JSON.stringify(entry.policy)).not.toContain("secret-token");
    expect((await lookupResponse(withToken(token)))?.kind).toBe("hit");
    expect(
      await lookupResponse(withToken("Bearer sntrys_other-token")),
    ).toBeUndefined();
  });

  it.each([
    ["Cache-Control: no-store", json(BODY, { "cache-control": "no-store" })],
    ["a non-2xx status", json({ detail: "Not found" }, {}, 404)],
  ])("does not store %s", async (_, response) => {
    const cache = createMemoryStore();
    expect(await store(cache, response)).toBe(0);
    expect(await cache.get(KEY)).toBeUndefined();
  });

  it("does not store a no-cache tier URL", async () => {
    const cache = createMemoryStore();
    expect(await store(cache, json(BODY), NO_CACHE_URL)).toBe(0);
    expect(await cache.get(KEY)).toBeUndefined();
  });

  it("throws for a body that is not JSON", async () => {
    const cache = createMemoryStore();
    const response = new Response("<html></html>", {
      headers: { "content-type": "text/html" },
    });
    await expect(store(cache, response)).rejects.toThrow(SyntaxError);
    expect(await cache.get(KEY)).toBeUndefined();
  });

  it("keeps an entry for its tier's TTL without server directives", async () => {
    const cache = recordingStore();
    await store(cache, json(BODY));
    await store(cache, json(BODY), VOLATILE_URL);
    expect(cache.ttls).toEqual([
      FALLBACK_TTL_MS.stable,
      FALLBACK_TTL_MS.volatile,
    ]);
  });

  it("keeps an entry with an ETag for the revalidation window too", async () => {
    const cache = recordingStore();
    await store(cache, json(BODY, { etag: '"v1"' }));
    await store(
      cache,
      json(BODY, { etag: '"v1"', "cache-control": "private, max-age=600" }),
    );
    expect(cache.ttls).toEqual([
      FALLBACK_TTL_MS.stable + REVALIDATION_WINDOW_MS,
      600_000 + REVALIDATION_WINDOW_MS,
    ]);
  });
});

describe("lookupResponse freshness", () => {
  it("misses when there is no entry", async () => {
    expect(await lookup(createMemoryStore())).toBeUndefined();
  });

  it("serves an entry without server directives for its tier's TTL", async () => {
    const cache = createMemoryStore();
    await store(longLived(cache), json(BODY), VOLATILE_URL);

    vi.setSystemTime(Date.now() + FALLBACK_TTL_MS.volatile);
    expect((await lookup(cache, VOLATILE_URL))?.kind).toBe("hit");

    vi.setSystemTime(Date.now() + 1);
    expect(await lookup(cache, VOLATILE_URL)).toBeUndefined();
  });

  it("lets server max-age outlast the tier", async () => {
    const cache = createMemoryStore();
    await store(
      cache,
      json(BODY, { "cache-control": "private, max-age=600" }),
      VOLATILE_URL,
    );
    vi.setSystemTime(Date.now() + 5 * MINUTE);
    expect((await lookup(cache, VOLATILE_URL))?.kind).toBe("hit");
  });

  it("treats max-age=0 as stale rather than falling back to the tier", async () => {
    const cache = createMemoryStore();
    await store(
      cache,
      json(BODY, { "cache-control": "max-age=0", etag: '"v1"' }),
    );
    expect((await lookup(cache))?.kind).toBe("stale");
  });

  it("misses for a body this runtime cannot decode", async () => {
    const cache = createMemoryStore();
    await store(cache, json(BODY));
    const entry = (await cache.get(KEY)) as CacheEntry;
    await cache.set(
      KEY,
      { ...entry, body: { ...entry.body, dictId: "unknown" } },
      MINUTE,
    );
    expect(await lookup(cache)).toBeUndefined();
  });

  it("throws for a corrupt policy", async () => {
    const cache = createMemoryStore();
    await store(cache, json(BODY));
    const entry = (await cache.get(KEY)) as CacheEntry;
    await cache.set(KEY, { ...entry, policy: { v: 999 } }, MINUTE);
    await expect(lookup(cache)).rejects.toThrow();
  });
});

describe("lookupResponse revalidation", () => {
  async function staleEntry(cache: CacheStore): Promise<void> {
    await store(cache, json(BODY, { etag: '"v1"' }));
    vi.setSystemTime(Date.now() + FALLBACK_TTL_MS.stable + MINUTE);
  }

  it("misses for a stale entry without an ETag", async () => {
    const cache = createMemoryStore();
    await store(longLived(cache), json(BODY));
    vi.setSystemTime(Date.now() + FALLBACK_TTL_MS.stable + MINUTE);
    expect(await lookup(cache)).toBeUndefined();
  });

  it("sends If-None-Match and serves the cached body on a matching 304", async () => {
    const cache = createMemoryStore();
    await staleEntry(cache);

    const stale = expectStale(await lookup(cache));
    expect(stale.conditionalHeaders).toEqual({ "if-none-match": '"v1"' });

    const response = await stale.revalidate(notModified({ etag: '"v1"' }));
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual(BODY);

    // The renewed entry is fresh again.
    await waitFor(async () => {
      expect((await lookup(cache))?.kind).toBe("hit");
    });
  });

  it.each([
    ["a 200", json({ data: [] }, { etag: '"v2"' })],
    ["a 304 for another ETag", notModified({ etag: '"v2"' })],
  ])("returns undefined for %s", async (_, response) => {
    const cache = createMemoryStore();
    await staleEntry(cache);
    const stale = expectStale(await lookup(cache));
    expect(await stale.revalidate(response)).toBeUndefined();
  });

  it("reports a failed renewal and still serves the body", async () => {
    const cache = createMemoryStore();
    await staleEntry(cache);
    const failure = new Error("disk full");
    const failing: CacheStore = {
      ...cache,
      set: () => Promise.reject(failure),
    };
    const onRenewError = vi.fn();

    const stale = expectStale(
      await lookupResponse({
        store: failing,
        codec,
        key: KEY,
        url: STABLE_URL,
        requestHeaders: {},
        onRenewError,
      }),
    );
    const response = await stale.revalidate(notModified({ etag: '"v1"' }));
    expect(await response?.json()).toEqual(BODY);
    await waitFor(() => expect(onRenewError).toHaveBeenCalledWith(failure));
  });
});
