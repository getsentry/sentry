import { describe, expect, it } from "vitest";
import { parseRetryDelayMs } from "../../src/api-client/rate-limit.ts";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0, 300);
const NOW_SECONDS = Math.floor(NOW / 1000);

/** Headers from a fixed-window 429, as Sentry's rate-limit middleware sends them. */
function windowLimited(
  resetSeconds: number,
  extra: Record<string, string> = {},
) {
  return new Headers({
    "X-Sentry-Rate-Limit-Remaining": "0",
    "X-Sentry-Rate-Limit-Limit": "40",
    "X-Sentry-Rate-Limit-Reset": String(resetSeconds),
    ...extra,
  });
}

describe("parseRetryDelayMs", () => {
  it("waits until the Sentry window reset", () => {
    expect(parseRetryDelayMs(429, windowLimited(NOW_SECONDS + 1), NOW)).toBe(
      700,
    );
  });

  it("measures the reset against the response Date when the local clock is skewed", () => {
    const serverNow = NOW + 10 * 60 * 1000;
    const headers = windowLimited(Math.floor(serverNow / 1000) + 1, {
      Date: new Date(serverNow).toUTCString(),
    });

    expect(parseRetryDelayMs(429, headers, NOW)).toBe(1000);
  });

  it("bounds the reset by the response Date when the local clock lags slightly", () => {
    // Local clock 1.5s behind: alone it would put a 1s window 2.2s away.
    const headers = windowLimited(NOW_SECONDS + 1, {
      Date: new Date(NOW).toUTCString(),
    });
    const lagging = NOW - 1500;

    expect(parseRetryDelayMs(429, headers, lagging)).toBe(1000);
  });

  it("bounds the reset by the response Date when the local clock runs ahead", () => {
    const headers = windowLimited(NOW_SECONDS + 1, {
      Date: new Date(NOW).toUTCString(),
    });

    // 2.5s ahead would put the reset 1.8s in the past; the Date puts it 0-1s
    // away, so the estimate is clamped to the lower bound.
    expect(parseRetryDelayMs(429, headers, NOW + 2500)).toBe(0);
  });

  it("keeps the local estimate when it agrees with the response Date", () => {
    const headers = windowLimited(NOW_SECONDS + 1, {
      Date: new Date(NOW).toUTCString(),
    });

    expect(parseRetryDelayMs(429, headers, NOW)).toBe(700);
  });

  it("treats a reset already in the past as no wait", () => {
    expect(parseRetryDelayMs(429, windowLimited(NOW_SECONDS - 5), NOW)).toBe(0);
  });

  it("gives no delay for a concurrency-limit 429", () => {
    const headers = new Headers({
      "X-Sentry-Rate-Limit-Remaining": "12",
      "X-Sentry-Rate-Limit-Reset": String(NOW_SECONDS + 1),
      "X-Sentry-Rate-Limit-ConcurrentRemaining": "0",
      "X-Sentry-Rate-Limit-ConcurrentLimit": "25",
    });

    expect(parseRetryDelayMs(429, headers, NOW)).toBeUndefined();
  });

  it("ignores the window reset on other statuses", () => {
    expect(
      parseRetryDelayMs(503, windowLimited(NOW_SECONDS + 1), NOW),
    ).toBeUndefined();
  });

  it("prefers Retry-After in seconds", () => {
    const headers = windowLimited(NOW_SECONDS + 1, { "Retry-After": "3" });

    expect(parseRetryDelayMs(429, headers, NOW)).toBe(3000);
  });

  it("accepts Retry-After as an HTTP-date on any status", () => {
    const headers = new Headers({
      "Retry-After": new Date(NOW + 5300).toUTCString(),
    });

    // HTTP-dates drop milliseconds, so this is 12:00:05.000.
    expect(parseRetryDelayMs(503, headers, NOW)).toBe(4700);
  });

  it("returns undefined for missing or malformed headers", () => {
    expect(parseRetryDelayMs(429, new Headers(), NOW)).toBeUndefined();
    expect(
      parseRetryDelayMs(429, new Headers({ "Retry-After": "soon" }), NOW),
    ).toBeUndefined();
    expect(
      parseRetryDelayMs(
        429,
        new Headers({
          "X-Sentry-Rate-Limit-Remaining": "0",
          "X-Sentry-Rate-Limit-Reset": "never",
        }),
        NOW,
      ),
    ).toBeUndefined();
  });
});
