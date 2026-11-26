/**
 * Reading Sentry's rate-limit headers. `@sentry/api` does not retry; a host
 * that retries, or reports when to try again, reads the wait from here.
 */

type HeaderReader = Pick<Headers, "get">;

/** The response `Date` header truncates server time to whole seconds. */
const DATE_RESOLUTION_MS = 1000;

/**
 * Milliseconds the response asks the client to wait, or undefined when it
 * gives no usable delay. `Retry-After` (seconds or HTTP-date) wins; a proxy
 * may add it, but Sentry itself does not. Otherwise a 429 waits for
 * `X-Sentry-Rate-Limit-Reset`, the Unix second the next window starts. A
 * concurrency-limit 429 is not tied to the window, so it gets no delay here
 * and the caller picks its own delay.
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
