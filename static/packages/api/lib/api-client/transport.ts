/**
 * Authenticated fetch for Sentry API requests, shared by the CLI and MCP.
 * Standard Web APIs only, so it runs in Node and Cloudflare Workers.
 *
 * Per request it sets the Authorization header, refreshes the credential once
 * after a 401 (any method), times out each attempt, retries through
 * `retry`, replays request bodies, optionally follows redirects only to
 * trusted origins, and serves and invalidates cached GETs through an injected
 * cache. The host supplies credentials, header rules, error classes, logging,
 * and spans.
 */

import {
  isIdempotentRequest,
  nextRetryDelayMs,
  parseRetryDelayMs,
  type RetryPolicy,
  sleep,
} from "./retry.js";
import { type ApiPathScope, parseApiPathScope } from "./api-path.js";
import { sentryBearerHeader } from "./auth-token.js";
import type { CacheLookup } from "./response-cache/policy.js";

type FetchInput = Request | string | URL;

/** The fields the transport reads; hosts extend it with their own. */
export type TransportCredential = {
  token: string;
  /** Stable hash of the login, for cache scoping; never a raw token. */
  identity: string;
};

/** The request a credential is chosen for; see {@link CredentialProvider.current}. */
export type CredentialRequest = {
  url: string;
  /**
   * The organization, and project when present, the URL path targets
   * ({@link parseApiPathScope}). Absent for unscoped paths.
   */
  scope?: ApiPathScope;
};

export type CredentialProvider<C extends TransportCredential> = {
  /**
   * The credential for a new request, before any refresh. Cache lookups use
   * it. A host with several logins can use `request.scope` to pick the one
   * that can reach the organization. The URL is already built, so the
   * credential must be valid for its origin.
   */
  current(request: CredentialRequest): C | Promise<C>;
  /** Called after a cache miss, before the first attempt, to refresh ahead of expiry. */
  prepare?(credential: C): Promise<C>;
  /** After a 401: the refreshed credential, or undefined when it cannot refresh. */
  refresh?(credential: C): Promise<C | undefined>;
  /** The Authorization value. Throws for a malformed token. */
  authorization?(credential: C): string;
};

/** How the caller reads a successful body; see {@link ApiTransportRequestOptions.responseBody}. */
export type ResponseBodyMode = "auto" | "buffer" | "stream";

/** The GET cache, keyed by the host. `CacheLookup` comes from `response-cache`. */
export type TransportCache = {
  lookup(request: CachedRequest): Promise<CacheLookup | undefined>;
  /** Store a successful GET; `response` is a clone the cache may consume. */
  store(request: CachedRequest, response: Response): Promise<void>;
  /** Drop entries a successful write to `url` made stale. */
  invalidate(url: string, identity: string): Promise<void>;
};

export type CachedRequest = {
  url: string;
  /** For `Vary` matching. */
  requestHeaders: Record<string, string>;
  identity: string;
};

type TransportLogger = {
  debug(message: string, ...args: unknown[]): void;
};

export type ApiTransportOptions<C extends TransportCredential> = {
  /**
   * Without credentials the transport leaves Authorization to the request,
   * does not refresh, and does not cache, since entries are scoped to the
   * credential's identity.
   */
  credentials?: CredentialProvider<C>;
  retry: RetryPolicy;
  /** Per-attempt timeout, or a function of the request URL. Default: none. */
  timeoutMs?: number | ((url: string) => number);
  /** Underlying fetch, read on each call. Defaults to `globalThis.fetch`. */
  fetch?: (input: FetchInput, init?: RequestInit) => Promise<Response>;
  /** Sent when the request sets no `User-Agent`. */
  userAgent?: string;
  /**
   * Add host headers, such as tracing or proxy headers, before Authorization
   * is set. Throw to reject the request, for example for an untrusted host.
   */
  prepareHeaders?(
    headers: Headers,
    request: { input: FetchInput; credential: C },
  ): void;
  /** Writes the host knows are safe to replay, such as a catalog of idempotent operations. */
  isIdempotent?(method: string, url: string): boolean;
  /** Set to `1` on the request replayed after a credential refresh. */
  refreshedRequestHeader?: string;
  /** Which origins may receive the credential when following redirects. */
  origins?: {
    trusts(url: URL, credential: C): boolean;
    /** The error for an untrusted or unusable redirect destination. */
    reject(destination: string, credential: C): Error;
  };
  /** Host error classes. Without them the transport throws its own. */
  errors?: {
    /**
     * The final attempt timed out. `idempotent` is false when a write may
     * have been applied.
     */
    timeout?(info: { timeoutMs: number; idempotent: boolean }): Error;
    /** A fetch error to throw at once, without retrying, such as a TLS failure. */
    fatal?(error: unknown): Error | undefined;
    /** A 429 that is not retried. Undefined returns the response. */
    rateLimited?(
      response: Response,
      info: { path: string; retryAfterMs: number | undefined },
    ): Promise<Error | undefined>;
  };
  cache?: TransportCache;
  /**
   * Whether the current scope skips cache reads, such as a tool call with
   * `fresh: true`. Hosts back it with request-scoped state like
   * `AsyncLocalStorage`. The response is still stored, replacing the entry.
   */
  fresh?(): boolean;
  logger?: TransportLogger;
  /** Wrap each request, including cache lookups, in a host span. */
  span?(
    request: { method: string; path: string },
    run: () => Promise<Response>,
  ): Promise<Response>;
};

export type ApiTransportRequestOptions = {
  /**
   * Replaying the request is harmless, so 5xx, timeouts, and network errors
   * retry for any method. For writes the server dedupes, such as
   * content-addressed chunk uploads.
   */
  idempotent?: boolean;
  /**
   * `buffer` reads a successful body within the attempt's timeout and retry
   * budget; `auto` does so only when it has a `Content-Type`, as the
   * `@sentry/api` auto parser returns a stream otherwise. Default `stream`.
   */
  responseBody?: ResponseBodyMode;
  /**
   * Follow redirects manually, checking each destination with `origins`
   * and recording where the response came from; see
   * {@link getValidatedResponseSource}. Skips the cache.
   */
  validateRedirects?: boolean;
};

export type ApiTransport = {
  request(
    input: FetchInput,
    init?: RequestInit,
    options?: ApiTransportRequestOptions,
  ): Promise<Response>;
};

/** The request's last attempt hit the transport's own timeout. */
export class ApiTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly idempotent: boolean;

  constructor(timeoutMs: number, idempotent: boolean) {
    super(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    this.name = "ApiTimeoutError";
    this.timeoutMs = timeoutMs;
    this.idempotent = idempotent;
  }
}

const MAX_REDIRECTS = 20;

/** Stands in for the credential when the host sets Authorization itself. */
const ANONYMOUS: TransportCredential = { token: "", identity: "" };

/** Where a response fetched with `validateRedirects` came from. */
export type ValidatedResponseSource = { origin: string; identity: string };

const validatedSources = new WeakMap<Response, ValidatedResponseSource>();

/** The final origin and credential identity of a `validateRedirects` response. */
export function getValidatedResponseSource(
  response: Response,
): ValidatedResponseSource | undefined {
  return validatedSources.get(response);
}

/** Extract the full URL from a fetch input; `String(request)` is not its URL. */
export function extractInputUrl(input: FetchInput): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

/** The URL pathname for logs and spans, or the raw input when it does not parse. */
export function extractUrlPath(input: FetchInput): string {
  const raw = extractInputUrl(input);
  try {
    return new URL(raw).pathname;
  } catch {
    return raw;
  }
}

/** Thrown inside an attempt for a host rejection that must not be retried. */
class Rejection {
  constructor(readonly error: unknown) {}
}

/** One attempt: a response, or a thrown error and our timeout if it caused it. */
type Outcome =
  | { response: Response }
  | { failed: unknown; timedOutAfterMs?: number };

type AttemptResult =
  | { action: "done"; response: Response }
  | { action: "retry"; delayMs: number }
  /** Send again at once, outside the retry budget: a credential refresh. */
  | { action: "replay" }
  | { action: "throw"; error: unknown };

type Send<C> = {
  input: FetchInput;
  init: RequestInit | undefined;
  method: string;
  url: string;
  path: string;
  /** Before `prepare`; its identity scopes the cache. */
  credential: C;
  options: ApiTransportRequestOptions;
  conditionalHeaders?: Record<string, string>;
};

/** Create a transport; see {@link ApiTransportOptions}. */
export function createApiTransport<C extends TransportCredential>(
  config: ApiTransportOptions<C>,
): ApiTransport {
  const { credentials, retry, logger } = config;
  const cache = credentials && config.cache;

  const baseFetch = (input: FetchInput, init?: RequestInit) =>
    (config.fetch ?? globalThis.fetch)(input, init);

  function authorization(credential: C): string | undefined {
    if (!credentials) {
      return;
    }
    if (credentials.authorization) {
      return credentials.authorization(credential);
    }
    const header = sentryBearerHeader(credential.token);
    if (header === null) {
      throw new Error("Malformed authentication token");
    }
    return header;
  }

  /**
   * The Authorization a cache lookup varies on: the value a send would set,
   * so a `Vary: Authorization` entry matches. None when the credential
   * cannot produce one yet; `prepare` may still replace it.
   */
  function lookupHeaders(credential: C): Record<string, string> {
    try {
      const value = authorization(credential);
      return value ? { authorization: value } : {};
    } catch {
      return {};
    }
  }

  function timeoutFor(url: string): number | undefined {
    return typeof config.timeoutMs === "function"
      ? config.timeoutMs(url)
      : config.timeoutMs;
  }

  /**
   * When the SDK calls fetch(request) with no init, read headers from the
   * Request: fetch(request, { headers }) replaces them per spec, which would
   * drop the SDK's Content-Type. The returned Headers are shared across
   * attempts; a 401 refresh updates them.
   */
  function buildHeaders(
    input: FetchInput,
    init: RequestInit | undefined,
    credential: C,
  ): Headers {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    config.prepareHeaders?.(headers, { input, credential });
    setAuthorization(headers, authorization(credential));
    if (config.userAgent && !headers.has("User-Agent")) {
      headers.set("User-Agent", config.userAgent);
    }
    return headers;
  }

  /**
   * Release an unused body without waiting: cancelling one branch of a teed
   * stream, as interceptors such as MSW hand out, settles only once the other
   * branch is read, which may never happen.
   */
  function cancelBody(response: Response): void {
    if (response.body && !response.bodyUsed) {
      response.body.cancel().catch((error: unknown) => {
        logger?.debug("Failed to cancel unused response body", error);
      });
    }
  }

  /**
   * One fetch with a timeout. A buffered body is drained from a clone within
   * the attempt, so a body failure can retry without consuming the caller's
   * copy.
   */
  async function fetchOnce(
    input: FetchInput,
    init: RequestInit,
    signal: AbortSignal | null | undefined,
    timeoutMs: number | undefined,
    mode: ResponseBodyMode,
  ): Promise<Outcome> {
    const controller = new AbortController();
    let timedOut = false;
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs);
    // Forward the caller's reason, so an aborted fetch rejects with it.
    const onAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }
    try {
      const response = await baseFetch(input, {
        ...init,
        signal: controller.signal,
      });
      if (shouldBuffer(response, mode)) {
        await drainBody(response.clone(), controller.signal);
      }
      return { response };
    } catch (error) {
      if (timedOut) {
        return { failed: error, timedOutAfterMs: timeoutMs };
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function rejectRedirect(
    response: Response,
    destination: string,
    credential: C,
  ): Promise<never> {
    cancelBody(response);
    throw new Rejection(
      config.origins?.reject(destination, credential) ??
        new Error(`Refusing to follow a redirect to ${destination}`),
    );
  }

  function trusts(url: URL, credential: C, original: URL): boolean {
    return config.origins
      ? config.origins.trusts(url, credential)
      : url.origin === original.origin;
  }

  async function nextRedirect(
    response: Response,
    request: Request,
    credential: C,
    visited: Set<string>,
    original: URL,
  ): Promise<URL> {
    const location = response.headers.get("location");
    if (!location) {
      return await rejectRedirect(response, "<unknown host>", credential);
    }
    if (visited.size > MAX_REDIRECTS) {
      return await rejectRedirect(response, "<too many redirects>", credential);
    }
    let next: URL;
    try {
      next = new URL(location, request.url);
    } catch (error) {
      logger?.debug(
        "Rejected malformed redirect location",
        error instanceof Error ? error.name : "unknown error",
      );
      return await rejectRedirect(response, "<invalid host>", credential);
    }
    if (!trusts(next, credential, original)) {
      return await rejectRedirect(response, next.origin, credential);
    }
    const key = redirectKey(next);
    if (visited.has(key)) {
      return await rejectRedirect(response, "<redirect loop>", credential);
    }
    visited.add(key);
    return next;
  }

  /** Follow each redirect by hand so the credential only reaches trusted origins. */
  async function fetchValidated(
    input: FetchInput,
    init: RequestInit | undefined,
    headers: Headers,
    credential: C,
    timeoutMs: number | undefined,
    mode: ResponseBodyMode,
  ): Promise<Outcome> {
    const original = new Request(input, init);
    const originalUrl = new URL(original.url);
    const visited = new Set([redirectKey(originalUrl)]);
    let request = original;
    let requestHeaders = new Headers(headers);

    // The host's prepareHeaders vets the first URL; nextRedirect vets each hop.
    for (;;) {
      const result = await fetchOnce(
        request.clone(),
        { headers: requestHeaders, redirect: "manual" },
        init?.signal ?? original.signal,
        timeoutMs,
        mode,
      );
      if (!("response" in result) || !isRedirect(result.response.status)) {
        const origin = httpOrigin(request.url);
        if ("response" in result && origin) {
          validatedSources.set(result.response, {
            origin,
            identity: credential.identity,
          });
        }
        return result;
      }
      const { response } = result;
      try {
        const next = await nextRedirect(
          response,
          request,
          credential,
          visited,
          originalUrl,
        );
        ({ request, headers: requestHeaders } = await redirectRequest(
          request,
          requestHeaders,
          next,
          response.status,
        ));
      } finally {
        cancelBody(response);
      }
    }
  }

  /** Send with refresh, timeouts, and retries; the cache is handled by the caller. */
  async function send(sendArgs: Send<C>): Promise<Response> {
    const { input, init, method, url, path, options } = sendArgs;
    let credential = credentials?.prepare
      ? await credentials.prepare(sendArgs.credential)
      : sendArgs.credential;
    const headers = buildHeaders(input, init, credential);
    for (const [name, value] of Object.entries(
      sendArgs.conditionalHeaders ?? {},
    )) {
      headers.set(name, value);
    }
    const nextInput = await replayableInput(input, init);
    const timeoutMs = timeoutFor(url);
    const idempotent =
      options.idempotent === true ||
      (config.isIdempotent?.(method, url) ?? false);
    const mode = options.responseBody ?? "stream";
    const signal =
      init?.signal !== undefined
        ? init.signal
        : input instanceof Request
          ? input.signal
          : undefined;
    let refreshed = false;
    let waitedMs = 0;

    const retryDelay = (
      attempt: number,
      status: number | undefined,
      serverDelayMs: number | undefined,
    ) =>
      nextRetryDelayMs({
        policy: retry,
        method,
        idempotent,
        status,
        serverDelayMs,
        attempt,
        waitedMs,
      });

    async function onResponse(
      response: Response,
      attempt: number,
    ): Promise<AttemptResult> {
      if (response.status === 401) {
        const next =
          refreshed || !credentials?.refresh
            ? undefined
            : await credentials.refresh(credential);
        if (!next) {
          return { action: "done", response };
        }
        refreshed = true;
        credential = next;
        setAuthorization(headers, authorization(next));
        if (config.refreshedRequestHeader) {
          headers.set(config.refreshedRequestHeader, "1");
        }
        cancelBody(response);
        return { action: "replay" };
      }

      const serverDelayMs = parseRetryDelayMs(
        response.status,
        response.headers,
      );
      const delayMs = retryDelay(attempt, response.status, serverDelayMs);
      if (delayMs !== undefined) {
        cancelBody(response);
        return { action: "retry", delayMs };
      }
      if (response.status === 429 && config.errors?.rateLimited) {
        const error = await config.errors.rateLimited(response, {
          path,
          retryAfterMs: serverDelayMs,
        });
        if (error) {
          return { action: "throw", error };
        }
      }
      return { action: "done", response };
    }

    function onFailure(
      { failed, timedOutAfterMs }: Extract<Outcome, { failed: unknown }>,
      attempt: number,
    ): AttemptResult {
      if (failed instanceof Rejection) {
        return { action: "throw", error: failed.error };
      }
      if (isAbort(failed, signal)) {
        return { action: "throw", error: failed };
      }
      const fatal = config.errors?.fatal?.(failed);
      if (fatal) {
        return { action: "throw", error: fatal };
      }
      const delayMs = retryDelay(attempt, undefined, undefined);
      if (delayMs !== undefined) {
        return { action: "retry", delayMs };
      }
      if (timedOutAfterMs === undefined) {
        return { action: "throw", error: failed };
      }
      // Whether the endpoint may have run, for the host's error wording.
      const replayable = isIdempotentRequest(method, idempotent);
      return {
        action: "throw",
        error:
          config.errors?.timeout?.({
            timeoutMs: timedOutAfterMs,
            idempotent: replayable,
          }) ?? new ApiTimeoutError(timedOutAfterMs, replayable),
      };
    }

    for (let attempt = 0; ; ) {
      const { input: attemptInput, init: attemptInit } = nextInput();
      let outcome: Outcome;
      try {
        outcome = options.validateRedirects
          ? await fetchValidated(
              attemptInput,
              attemptInit,
              headers,
              credential,
              timeoutMs,
              mode,
            )
          : await fetchOnce(
              attemptInput,
              { ...attemptInit, headers },
              signal,
              timeoutMs,
              mode,
            );
      } catch (error) {
        outcome = { failed: error };
      }
      // Outside the try: handling a response is not a fetch failure.
      const result =
        "response" in outcome
          ? await onResponse(outcome.response, attempt)
          : onFailure(outcome, attempt);

      if (result.action === "done") {
        storeInCache(
          method,
          url,
          sendArgs.credential.identity,
          headers,
          result.response,
        );
        await invalidateAfterWrite(
          method,
          url,
          sendArgs.credential.identity,
          result.response,
        );
        return result.response;
      }
      if (result.action === "throw") {
        throw result.error;
      }
      if (result.action === "replay") {
        logger?.debug(`${method} ${path} → replay with a refreshed credential`);
        continue;
      }
      logger?.debug(
        `${method} ${path} → retry ${attempt + 1}/${retry.maxRetries} after ${Math.round(result.delayMs)}ms`,
      );
      await sleep(result.delayMs, signal);
      waitedMs += result.delayMs;
      attempt++;
    }
  }

  /** Fire-and-forget: a cache write never delays or fails the response. */
  function storeInCache(
    method: string,
    url: string,
    identity: string,
    headers: Headers,
    response: Response,
  ): void {
    if (!cache || method !== "GET" || !response.ok) {
      return;
    }
    cache
      .store(
        {
          url,
          requestHeaders: { authorization: headers.get("Authorization") ?? "" },
          identity,
        },
        response.clone(),
      )
      .catch((error: unknown) => {
        logger?.debug("Response cache write failed", error);
      });
  }

  /**
   * Awaited so a later read in the same task sees fresh data, and never
   * throws: the write already succeeded.
   */
  async function invalidateAfterWrite(
    method: string,
    url: string,
    identity: string,
    response: Response,
  ): Promise<void> {
    if (!cache || method === "GET" || !response.ok) {
      return;
    }
    try {
      await cache.invalidate(url, identity);
    } catch (error) {
      logger?.debug("Post-mutation cache invalidation failed", error);
    }
  }

  async function request(
    input: FetchInput,
    init?: RequestInit,
    options: ApiTransportRequestOptions = {},
  ): Promise<Response> {
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = extractInputUrl(input);
    const path = extractUrlPath(input);

    const run = async (): Promise<Response> => {
      const startTime = performance.now();
      const elapsed = () => (performance.now() - startTime).toFixed(0);
      const credential = credentials
        ? await credentials.current(credentialRequest(url))
        : (ANONYMOUS as C);
      // A cached response has no validated origin, so discovery always
      // goes to the network.
      const lookup =
        cache &&
        method === "GET" &&
        !options.validateRedirects &&
        !config.fresh?.()
          ? await cache.lookup({
              url,
              requestHeaders: lookupHeaders(credential),
              identity: credential.identity,
            })
          : undefined;
      if (lookup?.kind === "hit") {
        logger?.debug(
          `${method} ${path} → ${lookup.response.status} (cache hit, ${elapsed()}ms)`,
        );
        return lookup.response;
      }

      const sendArgs = { input, init, method, url, path, credential, options };
      let response = await send({
        ...sendArgs,
        conditionalHeaders: lookup?.conditionalHeaders,
      });
      if (lookup?.kind === "stale" && response.status === 304) {
        const revalidated = await lookup.revalidate(response);
        if (revalidated) {
          logger?.debug(
            `${method} ${path} → 304 (revalidated cache entry, ${elapsed()}ms)`,
          );
          return revalidated;
        }
        // A 304 the entry cannot use has no body; fetch it unconditionally.
        response = await send(sendArgs);
      }
      logger?.debug(`${method} ${path} → ${response.status} (${elapsed()}ms)`);
      return response;
    };

    return config.span ? await config.span({ method, path }, run) : await run();
  }

  return { request };
}

function credentialRequest(url: string): CredentialRequest {
  const scope = parseApiPathScope(url);
  return scope ? { url, scope } : { url };
}

/**
 * Read a body to the end, or reject once `signal` aborts. A fetch whose body
 * ignores the signal after the headers, such as a mock, would otherwise stall
 * past the attempt's timeout. The abandoned read is left alone: cancelling
 * one branch of a tee waits for the other.
 */
async function drainBody(
  response: Response,
  signal: AbortSignal,
): Promise<void> {
  const drained = response.body?.pipeTo(new WritableStream());
  if (!drained) {
    return;
  }
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  try {
    await Promise.race([drained, aborted]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
    drained.catch(() => {});
  }
}

/** Whether `error` is the caller's abort, with the default or its own reason. */
function isAbort(error: unknown, signal: AbortSignal | null | undefined) {
  return (
    Boolean(signal?.aborted) &&
    (error === signal?.reason ||
      (error instanceof DOMException && error.name === "AbortError"))
  );
}

function shouldBuffer(response: Response, mode: ResponseBodyMode): boolean {
  const contentType = response.headers.get("Content-Type");
  // SSE reconnects and streaming parsers own consumption of their bodies.
  if (
    contentType?.split(";")[0]?.trim().toLowerCase() === "text/event-stream"
  ) {
    return false;
  }
  return (
    response.ok && (mode === "buffer" || (mode === "auto" && !!contentType))
  );
}

/**
 * A fresh `(input, init)` pair per attempt: `fetch` consumes a body, so a
 * retry would otherwise throw `Request body already used`. A `Request` is
 * cloned; a `ReadableStream` body, the only single-use body type, is read
 * once into a buffer. Other bodies pass through, which keeps the
 * `multipart/form-data` boundary `fetch` derives from `FormData`.
 */
async function replayableInput(
  input: FetchInput,
  init: RequestInit | undefined,
): Promise<() => { input: FetchInput; init: RequestInit | undefined }> {
  if (input instanceof Request) {
    return () => ({ input: input.clone(), init });
  }
  const body = init?.body;
  if (body instanceof ReadableStream) {
    const snapshot = await new Response(body).arrayBuffer();
    return () => ({ input, init: { ...init, body: snapshot } });
  }
  return () => ({ input, init });
}

function setAuthorization(headers: Headers, value: string | undefined): void {
  if (value !== undefined) {
    headers.set("Authorization", value);
  }
}

/** The origin of a credential-free HTTP(S) URL, or undefined. */
function httpOrigin(raw: string): string | undefined {
  const url = new URL(raw);
  return (url.protocol === "http:" || url.protocol === "https:") &&
    !url.username &&
    !url.password
    ? url.origin
    : undefined;
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function redirectKey(url: URL): string {
  const key = new URL(url);
  key.hash = "";
  return key.href;
}

/** The next hop's request; a 303, or a 301/302 after a POST, becomes a bodiless GET. */
async function redirectRequest(
  request: Request,
  requestHeaders: Headers,
  next: URL,
  status: number,
): Promise<{ request: Request; headers: Headers }> {
  const current = request.method.toUpperCase();
  const method =
    (status === 303 && current !== "HEAD") ||
    ((status === 301 || status === 302) && current === "POST")
      ? "GET"
      : current;
  const headers = new Headers(requestHeaders);
  if (method !== current) {
    headers.delete("content-length");
    headers.delete("content-type");
    headers.delete("transfer-encoding");
  }
  const body =
    method === current && request.body
      ? await request.clone().arrayBuffer()
      : undefined;
  return { request: new Request(next, { method, headers, body }), headers };
}
