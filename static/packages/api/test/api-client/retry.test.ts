import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isIdempotentRequest,
  nextRetryDelayMs,
  parseRetryDelayMs,
  type RetryPolicy,
  sleep,
} from "../../src/api-client/retry.ts";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0, 300);
const NOW_SECONDS = Math.floor(NOW / 1000);

const policy: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 250,
  maxDelayMs: 2000,
  maxTotalDelayMs: 3000,
};

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
    expect(
      nextRetryDelayMs({
        policy,
        method: "GET",
        status: 429,
        serverDelayMs: parseRetryDelayMs(429, headers, lagging),
        attempt: 0,
        waitedMs: 0,
        random: () => 0,
      }),
    ).toBe(1000);
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

describe("nextRetryDelayMs", () => {
  const base = {
    policy,
    method: "GET",
    status: 429,
    serverDelayMs: undefined,
    attempt: 0,
    waitedMs: 0,
    random: () => 0,
  };

  it("waits for the server delay plus jitter of at most half the base step", () => {
    expect(nextRetryDelayMs({ ...base, serverDelayMs: 700 })).toBe(700);
    expect(
      nextRetryDelayMs({ ...base, serverDelayMs: 700, random: () => 1 }),
    ).toBe(825);
  });

  it("falls back to equal-jitter exponential backoff", () => {
    expect(nextRetryDelayMs({ ...base, attempt: 0 })).toBe(125);
    expect(nextRetryDelayMs({ ...base, attempt: 0, random: () => 1 })).toBe(
      250,
    );
    expect(nextRetryDelayMs({ ...base, attempt: 1, random: () => 1 })).toBe(
      500,
    );
  });

  it("caps the backoff step at maxDelayMs", () => {
    expect(
      nextRetryDelayMs({
        ...base,
        policy: { ...policy, maxRetries: 10, maxTotalDelayMs: 60_000 },
        attempt: 6,
        random: () => 1,
      }),
    ).toBe(2000);
  });

  it("stops when the server delay exceeds the per-wait cap", () => {
    expect(
      nextRetryDelayMs({ ...base, serverDelayMs: 30_000 }),
    ).toBeUndefined();
  });

  it("stops when the wait would exceed the total budget", () => {
    expect(
      nextRetryDelayMs({
        ...base,
        attempt: 1,
        serverDelayMs: 1000,
        waitedMs: 2500,
      }),
    ).toBeUndefined();
  });

  it("stops after maxRetries", () => {
    expect(nextRetryDelayMs({ ...base, attempt: 2 })).toBeUndefined();
  });

  it("retries reads in any case", () => {
    for (const method of ["GET", "head", "OPTIONS"]) {
      expect(nextRetryDelayMs({ ...base, method })).toBe(125);
    }
  });

  it("retries a rate-limited write, since Sentry rejects it before the endpoint runs", () => {
    for (const method of ["POST", "PUT", "DELETE"]) {
      expect(nextRetryDelayMs({ ...base, method, status: 429 })).toBe(125);
    }
  });

  it("never retries a write on a 5xx without the idempotent opt-in", () => {
    for (const method of ["POST", "PUT", "DELETE"]) {
      for (const status of [500, 502, 503, 504]) {
        expect(nextRetryDelayMs({ ...base, method, status })).toBeUndefined();
      }
    }
    expect(
      nextRetryDelayMs({
        ...base,
        method: "POST",
        status: 503,
        idempotent: true,
      }),
    ).toBe(125);
  });

  it("retries a GET on a transient 5xx", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(nextRetryDelayMs({ ...base, status })).toBe(125);
    }
  });

  it("retries a network error or timeout only for idempotent requests", () => {
    expect(nextRetryDelayMs({ ...base, status: undefined })).toBe(125);
    expect(
      nextRetryDelayMs({ ...base, method: "POST", status: undefined }),
    ).toBeUndefined();
    expect(
      nextRetryDelayMs({
        ...base,
        method: "POST",
        status: undefined,
        idempotent: true,
      }),
    ).toBe(125);
  });

  it("does not retry deterministic 5xx codes or other 4xx", () => {
    for (const status of [400, 404, 501, 505]) {
      expect(nextRetryDelayMs({ ...base, status })).toBeUndefined();
    }
  });
});

describe("isIdempotentRequest", () => {
  it("replays only GET, HEAD, and OPTIONS by default", () => {
    for (const method of ["GET", "head", "OPTIONS"]) {
      expect(isIdempotentRequest(method)).toBe(true);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(isIdempotentRequest(method)).toBe(false);
    }
  });

  it("replays any method when the caller opts in", () => {
    expect(isIdempotentRequest("POST", true)).toBe(true);
  });
});

describe("sleep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves after the delay", async () => {
    const started = performance.now();
    const resolved = vi.fn();
    const promise = sleep(30).then(resolved);

    await delay(0);
    expect(resolved).not.toHaveBeenCalled();
    await promise;
    expect(resolved).toHaveBeenCalled();
    // Timers may fire up to a millisecond early.
    expect(performance.now() - started).toBeGreaterThanOrEqual(29);
  });

  it("rejects with the abort reason as soon as the signal aborts", async () => {
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const controller = new AbortController();
    const promise = sleep(60_000, controller.signal);
    const reason = new Error("cancelled");

    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("rejects at once when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("gone"));

    await expect(sleep(1000, controller.signal)).rejects.toThrow("gone");
  });
});
