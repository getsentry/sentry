import {getUtcDateString} from 'sentry/utils/dates';

// If the end time is within 10 minutes of now, we use a relative time range instead of an absolute one
const NEAR_NOW_THRESHOLD_MS = 10 * 60 * 1000;

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
  const intervalMs = Math.max((intervalSeconds ?? 60) * 1000, 60_000);
  const bufferMs = 10 * intervalMs;

  const desiredStart = startMs - bufferMs;
  const desiredEnd = truncateEndTime(endMs + bufferMs);

  const MAX_POINTS = 10_000;
  const pointsSpanMs = MAX_POINTS * intervalMs;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const maxSpanMs = Math.min(pointsSpanMs, ninetyDaysMs);

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
