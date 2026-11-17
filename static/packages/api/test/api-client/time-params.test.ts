import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiValidationError } from "../../src/api-client/errors.ts";
import {
  applyStatsMixinTimeParams,
  applyTimeParams,
  defaultStatsPeriod,
  normalizeStatsPeriod,
  parseStatsPeriod,
} from "../../src/api-client/time-params.ts";

function applied(apply: (query: URLSearchParams) => void): string {
  const query = new URLSearchParams();
  apply(query);
  return query.toString();
}

describe("normalizeStatsPeriod", () => {
  it.each([
    [" 24h ", "24h"],
    ["  ", undefined],
    [undefined, undefined],
  ])("normalizes %j to %j", (input, output) => {
    expect(normalizeStatsPeriod(input)).toBe(output);
  });
});

describe("defaultStatsPeriod", () => {
  it.each([
    [{}, "24h"],
    [{ statsPeriod: " 7d " }, "7d"],
    [{ start: "2026-01-01", end: "2026-01-02" }, undefined],
  ])("defaults %o to %j", (range, period) => {
    expect(defaultStatsPeriod(range)).toBe(period);
  });
});

describe("parseStatsPeriod", () => {
  it("splits the amount and unit", () => {
    expect(parseStatsPeriod("14d")).toEqual({ amount: 14, unit: "d" });
  });

  it("rejects other formats", () => {
    expect(() => parseStatsPeriod("1 day")).toThrow(ApiValidationError);
  });
});

describe("applyTimeParams", () => {
  it.each([
    [["24h"], "statsPeriod=24h"],
    [
      [undefined, "2026-01-01", "2026-01-02"],
      "start=2026-01-01&end=2026-01-02",
    ],
    [[], ""],
  ] as const)("applies %j as %s", (args, query) => {
    expect(applied((q) => applyTimeParams(q, ...args))).toBe(query);
  });

  it.each([
    ["24h", "2026-01-01", "2026-01-02"],
    [undefined, "2026-01-01", undefined],
  ])("rejects statsPeriod=%s start=%s end=%s", (statsPeriod, start, end) => {
    expect(() =>
      applyTimeParams(new URLSearchParams(), statsPeriod, start, end),
    ).toThrow(ApiValidationError);
  });
});

describe("applyStatsMixinTimeParams", () => {
  afterEach(() => vi.useRealTimers());

  it("turns a relative period into seconds before now", () => {
    vi.setSystemTime(10_000_000);

    expect(
      applied((q) =>
        applyStatsMixinTimeParams(q, "1h", undefined, undefined, 60),
      ),
    ).toBe("since=6400&until=10000&resolution=60s");
  });

  it("turns an absolute range into seconds", () => {
    expect(
      applied((q) =>
        applyStatsMixinTimeParams(
          q,
          undefined,
          "1970-01-01T00:00:10Z",
          "1970-01-01T00:00:20Z",
        ),
      ),
    ).toBe("since=10&until=20");
  });

  it("rejects an unparseable date", () => {
    expect(() =>
      applyStatsMixinTimeParams(new URLSearchParams(), undefined, "x", "y"),
    ).toThrow(ApiValidationError);
  });
});
