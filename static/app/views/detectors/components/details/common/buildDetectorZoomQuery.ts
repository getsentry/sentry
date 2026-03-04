import moment from 'moment-timezone';

import {parseStatsPeriod} from 'sentry/components/pageFilters/parse';
import {getUtcDateString} from 'sentry/utils/dates';

// If the end time is within 10 minutes of now, we use a relative time range instead of an absolute one
const NEAR_NOW_THRESHOLD_MS = 10 * 60 * 1000;
const MIN_INTERVAL_MS = 60_000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_DETECTOR_CHART_POINTS = 10_000;

interface ComputeZoomRangeOptions {
  endMs: number;
  startMs: number;
  intervalSeconds?: number;
}

interface AbsoluteZoomRangeMs {
  end: number;
  start: number;
}

interface RelativeZoomRangeMs {
  statsPeriod: string;
}

type ZoomRangeMs = AbsoluteZoomRangeMs | RelativeZoomRangeMs;

interface LimitDateTimeParamsToMaxPointsOptions {
  end?: string | null;
  intervalSeconds?: number;
  start?: string | null;
  statsPeriod?: string | null;
}

interface LimitDateTimeParamsToMaxPointsResult {
  dateTimeParams: {
    end?: string;
    start?: string;
    statsPeriod?: string;
  };
  isRangeLimited: boolean;
}

function getMaxSpanMs(intervalSeconds?: number): number {
  const intervalMs = Math.max((intervalSeconds ?? 60) * 1000, MIN_INTERVAL_MS);
  const pointsSpanMs = MAX_DETECTOR_CHART_POINTS * intervalMs;
  return Math.min(pointsSpanMs, NINETY_DAYS_MS);
}

function parseStatsPeriodDurationMs(statsPeriod: string): number | null {
  const parsed = parseStatsPeriod(statsPeriod);
  if (!parsed) {
    return null;
  }

  const period = Number(parsed.period);
  if (!Number.isFinite(period)) {
    return null;
  }

  const periodLengthMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }[parsed.periodLength];

  return period * periodLengthMs;
}

function parseDateTimeMs(dateTime?: string | null): number | null {
  if (!dateTime) {
    return null;
  }

  const parsedDateTime = moment.utc(dateTime);
  if (!parsedDateTime.isValid()) {
    return null;
  }

  return parsedDateTime.valueOf();
}

function toStatsPeriod(durationMs: number): string {
  const hourMs = 60 * 60 * 1000;
  const durationHours = Math.max(Math.ceil(durationMs / hourMs), 4);

  if (durationHours > 24) {
    return `${Math.ceil(durationHours / 24)}d`;
  }

  return `${durationHours}h`;
}

function truncateEndTime(endMs: number): number {
  if (endMs >= Date.now() - NEAR_NOW_THRESHOLD_MS) {
    return Date.now();
  }

  return endMs;
}

/**
 * Compute a zoom window around a time range with padding and safe bounds.
 * - Adds ~10 data points of context on each side based on intervalSeconds
 * - Clamps total span to <= 10k points and <= 90 days
 * - Aligns start/end to minute boundaries
 * - For ranges that are still active/near-now, returns a relative statsPeriod
 */
export function computeZoomRangeMs({
  startMs,
  endMs,
  intervalSeconds,
}: ComputeZoomRangeOptions): ZoomRangeMs {
  const intervalMs = Math.max((intervalSeconds ?? 60) * 1000, MIN_INTERVAL_MS);
  const bufferMs = 10 * intervalMs;

  const desiredStart = startMs - bufferMs;
  const desiredEnd = truncateEndTime(endMs + bufferMs);

  const maxSpanMs = getMaxSpanMs(intervalSeconds);

  const endIsNearNow = desiredEnd >= Date.now() - NEAR_NOW_THRESHOLD_MS;
  let zoomStartMs = desiredStart;
  const zoomEndMs = endIsNearNow ? Date.now() : desiredEnd;
  if (zoomEndMs - zoomStartMs > maxSpanMs) {
    zoomStartMs = zoomEndMs - maxSpanMs;
  }

  if (endIsNearNow) {
    return {statsPeriod: toStatsPeriod(Date.now() - zoomStartMs)};
  }

  const start = Math.floor(zoomStartMs / 60_000) * 60_000;
  const end = Math.ceil(zoomEndMs / 60_000) * 60_000;

  return {start, end};
}

/**
 * Ensure detector chart date params request no more than 10k points. The
 * event stats endpoint will respond with a 400 if we request more than that.
 */
export function limitDateTimeParamsToMaxPoints({
  start,
  end,
  statsPeriod,
  intervalSeconds,
}: LimitDateTimeParamsToMaxPointsOptions): LimitDateTimeParamsToMaxPointsResult {
  const maxSpanMs = getMaxSpanMs(intervalSeconds);

  if (statsPeriod) {
    const statsPeriodDurationMs = parseStatsPeriodDurationMs(statsPeriod);
    if (!statsPeriodDurationMs || statsPeriodDurationMs <= maxSpanMs) {
      return {
        dateTimeParams: {statsPeriod},
        isRangeLimited: false,
      };
    }

    return {
      dateTimeParams: {statsPeriod: toStatsPeriod(maxSpanMs)},
      isRangeLimited: true,
    };
  }

  const startMs = parseDateTimeMs(start);
  const endMs = parseDateTimeMs(end);
  if (startMs === null || endMs === null || endMs <= startMs) {
    return {
      dateTimeParams: {
        start: start ?? undefined,
        end: end ?? undefined,
      },
      isRangeLimited: false,
    };
  }

  if (endMs - startMs <= maxSpanMs) {
    return {
      dateTimeParams: {
        start: start ?? undefined,
        end: end ?? undefined,
      },
      isRangeLimited: false,
    };
  }

  return {
    dateTimeParams: {
      start: getUtcDateString(endMs - maxSpanMs),
      end: getUtcDateString(endMs),
    },
    isRangeLimited: true,
  };
}

/**
 * Build a query object that applies the zoom window to URL params.
 * Uses statsPeriod for ongoing near-now windows and absolute start/end otherwise.
 */
export function buildDetectorZoomQuery(
  existingQuery: Record<string, any>,
  zoomRange: ZoomRangeMs
) {
  if ('statsPeriod' in zoomRange) {
    return {
      ...existingQuery,
      start: undefined,
      end: undefined,
      statsPeriod: zoomRange.statsPeriod,
    };
  }

  return {
    ...existingQuery,
    start: getUtcDateString(zoomRange.start),
    end: getUtcDateString(zoomRange.end),
    statsPeriod: undefined,
  };
}
