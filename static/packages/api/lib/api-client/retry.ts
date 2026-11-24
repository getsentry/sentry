/**
 * Retry policy for Sentry API requests. Pure logic over standard Web APIs, so
 * it runs in Node and Cloudflare Workers. Each product owns its request loop,
 * error classes, and caps; this module decides whether to retry and how long
 * to wait. A 401 credential refresh is not a retry here: the transport may
 * replay any method once after refreshing, because the endpoint never ran.
 */

/** Caps for one logical request. All delays are in milliseconds. */
export type RetryPolicy = {
  /** Retries after the first attempt. */
  maxRetries: number;
  /** First fallback backoff step; it doubles on each retry. */
  baseDelayMs: number;
  /** Longest single wait. A server delay above this is not waited for. */
  maxDelayMs: number;
  /** Longest total wait across every retry of the request. */
  maxTotalDelayMs: number;
};

type HeaderReader = Pick<Headers, "get">;

const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

/**
 * The statuses that are retried, and which requests each may replay. This is
 * the one rule for every host of the shared client.
 *
 * - `any`: Sentry's `RatelimitMiddleware` rejects a 429 in `process_request`,
 *   before the view runs (`sentry/middleware/ratelimit.py`), so replaying any
 *   method is safe.
 * - `idempotent`: the endpoint may have run, so only GET, HEAD, and OPTIONS
 *   retry, unless the caller marks the request `idempotent`.
 *
 * Other 5xx codes (501, 505, ...) are deterministic and are not retried.
 */
const RETRYABLE_STATUSES: ReadonlyMap<number, "any" | "idempotent"> = new Map([
  [429, "any"],
  [500, "idempotent"],
  [502, "idempotent"],
  [503, "idempotent"],
  [504, "idempotent"],
]);

/** The response `Date` header truncates server time to whole seconds. */
const DATE_RESOLUTION_MS = 1000;

/**
 * Whether a request may be replayed after the endpoint may have run: a
 * transient 5xx, a network error, or a timeout. True for GET, HEAD, and
 * OPTIONS, or when the caller marks the request `idempotent`.
 */
export function isIdempotentRequest(
  method: string,
  idempotent = false,
): boolean {
  return idempotent || IDEMPOTENT_METHODS.has(method.toUpperCase());
}

/**
 * Whether `RETRYABLE_STATUSES` lets this failed request be sent again. With
 * no status (a network error or timeout), the endpoint may have run, so only
 * idempotent requests replay.
 */
function isRetryable(
  method: string,
  status: number | undefined,
  idempotent = false,
): boolean {
  const replays =
    status === undefined ? "idempotent" : RETRYABLE_STATUSES.get(status);
  if (replays === undefined) {
    return false;
  }
  return replays === "any" || isIdempotentRequest(method, idempotent);
}

/**
 * Milliseconds the response asks the client to wait, or undefined when it
 * gives no usable delay. `Retry-After` (seconds or HTTP-date) wins; a proxy
 * may add it, but Sentry itself does not. Otherwise a 429 waits for
 * `X-Sentry-Rate-Limit-Reset`, the Unix second the next window starts. A
 * concurrency-limit 429 is not tied to the window, so it gets no delay here
 * and the caller falls back to backoff.
 */
export function parseRetryDelayMs(
  status: number,
  headers: HeaderReader,
  now: number = Date.now(),
): number | undefined {
  const retryAfter = headers.get("retry-after")?.trim();
  if (retryAfter) {
    if (/^\d+$/.test(retryAfter)) {
      return Number(retryAfter) * 1000;
    }
    const date = Date.parse(retryAfter);
    return Number.isNaN(date) ? undefined : delayUntil(date, headers, now);
  }

  if (status !== 429 || !isWindowLimited(headers)) {
    return undefined;
  }
  const reset = Number(headers.get("x-sentry-rate-limit-reset"));
  if (!Number.isFinite(reset) || reset <= 0) {
    return undefined;
  }
  return delayUntil(reset * 1000, headers, now);
}

/**
 * Delay before the next retry, or undefined to stop and surface the error.
 * Stops when the method or status is not retryable, the retries are used up,
 * the server delay exceeds `maxDelayMs`, or the wait would exceed
 * `maxTotalDelayMs`.
 */
export function nextRetryDelayMs({
  policy,
  method,
  idempotent,
  status,
  serverDelayMs,
  attempt,
  waitedMs,
  random = Math.random,
}: {
  policy: RetryPolicy;
  method: string;
  idempotent?: boolean;
  /** Failed response status, or undefined for a network error or timeout. */
  status: number | undefined;
  /** From `parseRetryDelayMs` for the failed response. */
  serverDelayMs: number | undefined;
  /** Retries already made for this request, starting at 0. */
  attempt: number;
  /** Total time already spent waiting for this request. */
  waitedMs: number;
  random?: () => number;
}): number | undefined {
  if (
    attempt >= policy.maxRetries ||
    !isRetryable(method, status, idempotent)
  ) {
    return undefined;
  }

  let delayMs: number;
  if (serverDelayMs !== undefined) {
    if (serverDelayMs > policy.maxDelayMs) {
      return undefined;
    }
    // Spread clients that share a window so they don't all wake at its start.
    delayMs = serverDelayMs + random() * (policy.baseDelayMs / 2);
  } else {
    // Equal jitter: half the step is fixed, half is random.
    const step = Math.min(policy.baseDelayMs * 2 ** attempt, policy.maxDelayMs);
    delayMs = step / 2 + random() * (step / 2);
  }

  return waitedMs + delayMs > policy.maxTotalDelayMs ? undefined : delayMs;
}

/** Wait `ms`, or reject with the signal's reason as soon as it aborts. */
export function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Milliseconds until a server-clock `target`. The local clock gives the finest
 * estimate, but it may be skewed. The response `Date` bounds the server's
 * clock to `[date, date + 1s)`, so the true delay lies in
 * `(target - date - 1s, target - date]`; the local estimate is clamped into it.
 */
function delayUntil(
  target: number,
  headers: HeaderReader,
  now: number,
): number {
  let delay = target - now;
  const date = Date.parse(headers.get("date") ?? "");
  if (!Number.isNaN(date)) {
    const latest = target - date;
    delay = Math.min(Math.max(delay, latest - DATE_RESOLUTION_MS), latest);
  }
  return Math.max(0, delay);
}

/**
 * Sentry sends `Remaining: 0` only when the fixed window is exhausted
 * (`above_rate_limit_check` in `sentry/ratelimits/utils.py`). Otherwise the
 * 429 came from the concurrency limit and the window reset is irrelevant.
 */
function isWindowLimited(headers: HeaderReader): boolean {
  return headers.get("x-sentry-rate-limit-remaining") === "0";
}
