/**
 * Time range query parameters shared by the endpoints that take one:
 * `statsPeriod` or a `start`/`end` pair, or the `since`/`until` seconds of
 * Sentry's `StatsMixin` endpoints.
 */

import { ApiValidationError } from "./errors.js";

/** A trimmed `statsPeriod`, or undefined when it is blank. */
export function normalizeStatsPeriod(statsPeriod?: string): string | undefined {
  const normalized = statsPeriod?.trim();
  return normalized || undefined;
}

/**
 * The relative period to query: the trimmed `statsPeriod`, or 24 hours when
 * neither it nor an absolute `start` or `end` is given.
 */
export function defaultStatsPeriod({
  statsPeriod,
  start,
  end,
}: {
  statsPeriod?: string;
  start?: string;
  end?: string;
}): string | undefined {
  const normalized = normalizeStatsPeriod(statsPeriod);
  return start || end ? normalized : (normalized ?? "24h");
}

/**
 * Split a relative period such as `24h` into its amount and unit.
 *
 * @throws {ApiValidationError} For any other format
 */
export function parseStatsPeriod(statsPeriod: string): {
  amount: number;
  unit: string;
} {
  const match = /^(\d+)([smhdw])$/.exec(statsPeriod);
  if (!match?.[2]) {
    throw new ApiValidationError(
      "statsPeriod must use a supported relative time format, such as `24h`, `7d`, or `2w`.",
    );
  }
  return {
    amount: Number(match[1]),
    unit: match[2],
  };
}

/**
 * Validates and applies time parameters to a URLSearchParams object.
 *
 * Enforces mutual exclusivity between relative (statsPeriod) and
 * absolute (start/end) time ranges, and ensures start/end are paired.
 *
 * @param queryParams The URLSearchParams to modify
 * @param statsPeriod Relative time period (e.g., "24h", "7d")
 * @param start Absolute start time (ISO 8601)
 * @param end Absolute end time (ISO 8601)
 * @throws {ApiValidationError} If time parameters are invalid
 */
export function applyTimeParams(
  queryParams: URLSearchParams,
  statsPeriod?: string,
  start?: string,
  end?: string,
): void {
  if (statsPeriod && (start || end)) {
    throw new ApiValidationError(
      "Cannot use both statsPeriod and start/end parameters. Use either statsPeriod for relative time or start/end for absolute time.",
    );
  }
  if ((start && !end) || (!start && end)) {
    throw new ApiValidationError(
      "Both start and end parameters must be provided together for absolute time ranges.",
    );
  }
  if (statsPeriod) {
    queryParams.set("statsPeriod", statsPeriod);
  } else if (start && end) {
    queryParams.set("start", start);
    queryParams.set("end", end);
  }
}

/**
 * Like {@link applyTimeParams}, but as the `since` and `until` Unix seconds
 * that `StatsMixin` endpoints read, with an optional `resolution`. A missing
 * range means the last 24 hours.
 *
 * @throws {ApiValidationError} If time parameters are invalid
 */
export function applyStatsMixinTimeParams(
  queryParams: URLSearchParams,
  statsPeriod?: string,
  start?: string,
  end?: string,
  resolutionSeconds?: number,
): void {
  if (statsPeriod && (start || end)) {
    throw new ApiValidationError(
      "Cannot use both statsPeriod and start/end parameters. Use either statsPeriod for relative time or start/end for absolute time.",
    );
  }
  if ((start && !end) || (!start && end)) {
    throw new ApiValidationError(
      "Both start and end parameters must be provided together for absolute time ranges.",
    );
  }

  let since: number;
  let until: number;

  if (start && end) {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new ApiValidationError(
        "start and end parameters must be valid ISO 8601 date strings.",
      );
    }
    since = Math.floor(startMs / 1000);
    until = Math.floor(endMs / 1000);
  } else {
    const period = statsPeriod ?? "24h";
    const { amount, unit } = parseStatsPeriod(period);
    let unitSeconds: number;
    switch (unit) {
      case "s":
        unitSeconds = 1;
        break;
      case "m":
        unitSeconds = 60;
        break;
      case "h":
        unitSeconds = 60 * 60;
        break;
      case "d":
        unitSeconds = 60 * 60 * 24;
        break;
      case "w":
        unitSeconds = 60 * 60 * 24 * 7;
        break;
      default:
        throw new ApiValidationError(
          "statsPeriod must use a supported relative time format, such as `24h`, `7d`, or `2w`.",
        );
    }
    until = Math.floor(Date.now() / 1000);
    since = until - amount * unitSeconds;
  }

  queryParams.set("since", String(since));
  queryParams.set("until", String(until));
  if (resolutionSeconds !== undefined) {
    queryParams.set("resolution", `${resolutionSeconds}s`);
  }
}
