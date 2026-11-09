/**
 * HTTP caching decisions for Sentry API GET responses, through
 * `http-cache-semantics` (RFC 9111). Server cache directives win; a response
 * without them stays fresh for its URL's fallback tier. A stale entry with an
 * `ETag` is kept for a revalidation window and renewed by a matching 304.
 *
 * Works on any `CacheStore` and `BodyCodec` the host passes in, with no Node
 * APIs. The host derives the key, decides whether caching is enabled, and
 * records telemetry around these calls.
 */

import CachePolicy from "http-cache-semantics";
import type { BodyCodec } from "./body.js";
import type { CacheEntry, CacheStore } from "./store.js";
import { classifyUrl, FALLBACK_TTL_MS } from "./tiers.js";

/**
 * How long a stale entry with an `ETag` is kept for revalidation. Bounded
 * by the store's byte budget like any other entry.
 */
export const REVALIDATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Policy options for a cache scoped to one identity: keys already separate
 * users, so `private` responses are storable.
 */
const POLICY_OPTIONS: CachePolicy.Options = {
  shared: false,
  cacheHeuristic: 0.1,
};

/** Response headers kept for callers, such as `Link` for pagination. */
const PRESERVED_HEADERS = ["link"];

const encoder = new TextEncoder();

/**
 * Result of a lookup that found a usable entry.
 *
 * - `hit`: the entry is fresh; serve `response`. `createdAt` is when the
 *   response was received, and `size` is the decoded body size in bytes.
 * - `stale`: the entry is stale but has an `ETag`. Send the request with
 *   `conditionalHeaders`, then pass the network response to `revalidate`.
 *   On a matching 304 it renews the entry and returns the cached body;
 *   otherwise it returns `undefined` and the network response stands (or,
 *   for an unusable 304, the caller fetches again without the headers).
 */
export type CacheLookup =
  | { kind: "hit"; response: Response; createdAt: number; size: number }
  | {
      kind: "stale";
      conditionalHeaders: Record<string, string>;
      revalidate(response: Response): Promise<Response | undefined>;
    };

export type LookupOptions = {
  store: CacheStore;
  codec: BodyCodec;
  /** From `buildCacheKey`, so the entry is scoped to the identity. */
  key: string;
  url: string;
  /** Headers of the new request, for `Vary` matching. */
  requestHeaders: Record<string, string>;
  /** Called when renewing a revalidated entry fails; the response stands. */
  onRenewError?: (error: unknown) => void;
};

export type StoreOptions = {
  store: CacheStore;
  codec: BodyCodec;
  /** From `buildCacheKey` for the same identity, method, and URL. */
  key: string;
  /** Recorded on the entry for identity-scoped invalidation. */
  identity: string;
  url: string;
  /** Headers the request was sent with, for `Vary` matching. */
  requestHeaders: Record<string, string>;
  /** The response to cache; its body is consumed. */
  response: Response;
};

/** A GET request as `http-cache-semantics` reads it. */
type GetRequest = {
  url: string;
  method: "GET";
  headers: Record<string, string>;
};

type Revalidation = CachePolicy.RevalidationPolicy & {
  /** Missing from the published types. */
  matches?: boolean;
};

/** Keep only the response headers callers need. */
function pickHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of PRESERVED_HEADERS) {
    const value = headers.get(name);
    if (value) {
      result[name] = value;
    }
  }
  return result;
}

/**
 * Request headers as the policy records them, with `authorization` replaced
 * by its SHA-256 digest. `CachePolicy#toObject()` keeps request headers when
 * the response has `Vary`, and a store must never hold the token. Lookup and
 * store derive the value the same way, so `Vary: Authorization` still tells
 * tokens apart.
 */
async function policyRequestHeaders(
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    result[name] =
      name.toLowerCase() === "authorization" && value
        ? await sha256Hex(value)
        : value;
  }
  return result;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function headersToObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

/**
 * Whether the server sent `Cache-Control` directives. `timeToLive() === 0`
 * alone is ambiguous: it means both "no headers" (use the fallback tier)
 * and "max-age=0" (do not reuse).
 */
function hasServerCacheDirectives(policy: CachePolicy): boolean {
  return Object.keys(policy.toObject().rescc).length > 0;
}

/**
 * Whether `entry` can be served without revalidation: by the server's
 * directives when it sent any, otherwise by the URL's fallback tier.
 */
function isEntryFresh(
  policy: CachePolicy,
  entry: CacheEntry,
  request: GetRequest,
): boolean {
  if (policy.satisfiesWithoutRevalidation(request)) {
    return true;
  }
  if (hasServerCacheDirectives(policy)) {
    return false;
  }
  const fallbackTtl = FALLBACK_TTL_MS[classifyUrl(request.url)];
  return Date.now() - entry.createdAt <= fallbackTtl;
}

/**
 * How long a store keeps an entry: its freshness lifetime (the server's when
 * it sent cache directives, otherwise the URL tier's), plus
 * {@link REVALIDATION_WINDOW_MS} when it has an `ETag`.
 */
function retentionMs(policy: CachePolicy, tier: CacheEntry["tier"]): number {
  const freshMs = hasServerCacheDirectives(policy)
    ? policy.timeToLive()
    : FALLBACK_TTL_MS[tier];
  return policy.responseHeaders().etag === undefined
    ? freshMs
    : freshMs + REVALIDATION_WINDOW_MS;
}

/**
 * Headers for a response served from `entry`: the policy's computed headers,
 * with multiple values joined, plus the preserved headers it lacks.
 */
function buildResponseHeaders(
  policy: CachePolicy,
  entry: CacheEntry,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(policy.responseHeaders())) {
    if (value !== undefined) {
      result[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  for (const [name, value] of Object.entries(entry.headers)) {
    if (!(name in result)) {
      result[name] = value;
    }
  }
  return result;
}

/**
 * A decoded body as a `Response` body. TypeScript 5.9's DOM `BodyInit`
 * takes only `ArrayBuffer`-backed views; stored bodies never sit on a
 * `SharedArrayBuffer`.
 */
function responseBody(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes as Uint8Array<ArrayBuffer>;
}

/** A `stale` lookup for an entry with an `ETag`, or `undefined` without one. */
function staleLookup(
  options: LookupOptions,
  entry: CacheEntry,
  policy: CachePolicy,
  request: GetRequest,
): CacheLookup | undefined {
  const etag = policy.revalidationHeaders(request)["if-none-match"];
  if (typeof etag !== "string") {
    return;
  }
  const { store, codec, key, onRenewError } = options;

  return {
    kind: "stale",
    conditionalHeaders: { "if-none-match": etag },
    async revalidate(response) {
      if (response.status !== 304) {
        return;
      }
      const result: Revalidation = policy.revalidatedPolicy(request, {
        status: response.status,
        headers: headersToObject(response.headers),
      });
      // A 304 for a different or missing validator says nothing about
      // this entry, so its body cannot be trusted.
      if (result.modified || result.matches === false) {
        return;
      }
      const body = await codec.decode(entry.body);
      if (!body) {
        return;
      }

      const renewed = {
        ...entry,
        policy: result.policy.toObject(),
        createdAt: Date.now(),
      };
      store
        .set(key, renewed, retentionMs(result.policy, entry.tier))
        .catch((error: unknown) => onRenewError?.(error));
      return new Response(responseBody(body), {
        status: entry.status,
        headers: buildResponseHeaders(result.policy, entry),
      });
    },
  };
}

/**
 * Look up a GET request: a fresh entry is a `hit`, and a stale one with an
 * `ETag` is returned for conditional revalidation.
 *
 * @returns The lookup, or `undefined` on a miss: no entry, a stale entry
 *   without an `ETag`, or a body this runtime cannot decode
 * @throws When the stored policy or body is corrupt; the host may drop the
 *   entry and treat it as a miss
 */
export async function lookupResponse(
  options: LookupOptions,
): Promise<CacheLookup | undefined> {
  const { store, codec, key, url, requestHeaders } = options;
  const entry = await store.get(key);
  if (!entry) {
    return;
  }

  const policy = CachePolicy.fromObject(
    entry.policy as CachePolicy.CachePolicyObject,
  );
  const request: GetRequest = {
    url,
    method: "GET",
    headers: await policyRequestHeaders(requestHeaders),
  };
  if (!isEntryFresh(policy, entry, request)) {
    return staleLookup(options, entry, policy, request);
  }

  const body = await codec.decode(entry.body);
  if (!body) {
    return;
  }
  return {
    kind: "hit",
    response: new Response(responseBody(body), {
      status: entry.status,
      headers: buildResponseHeaders(policy, entry),
    }),
    createdAt: entry.createdAt,
    size: body.byteLength,
  };
}

/**
 * Store a successful GET response when HTTP caching allows it: not for
 * `no-store`, a non-2xx status, or a `no-cache` tier URL. The entry is kept
 * for its freshness lifetime, plus the revalidation window with an `ETag`.
 *
 * @returns The stored (encoded) body size in bytes, or 0 when not stored
 * @throws When the body is not JSON, the only kind cached
 */
export async function storeResponse(options: StoreOptions): Promise<number> {
  const { store, codec, key, identity, url, requestHeaders, response } =
    options;
  const tier = classifyUrl(url);
  if (!response.ok || tier === "no-cache") {
    return 0;
  }

  const policy = new CachePolicy(
    {
      url,
      method: "GET",
      headers: await policyRequestHeaders(requestHeaders),
    },
    { status: response.status, headers: headersToObject(response.headers) },
    POLICY_OPTIONS,
  );
  if (!policy.storable()) {
    return 0;
  }

  const text = await response.text();
  // Only JSON is cached; this throws for anything else.
  JSON.parse(text);
  const createdAt = Date.now();
  const body = await codec.encode(encoder.encode(text));
  await store.set(
    key,
    {
      url,
      identity,
      tier,
      status: response.status,
      headers: pickHeaders(response.headers),
      body,
      policy: policy.toObject(),
      createdAt,
    },
    retentionMs(policy, tier),
  );
  return body.bytes.byteLength;
}
