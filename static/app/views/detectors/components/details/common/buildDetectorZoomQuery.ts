import {getUtcDateString} from 'sentry/utils/dates';

interface ComputeZoomRangeOptions {
  endMs: number;
  startMs: number;
  intervalSeconds?: number;
}

interface ZoomRangeMs {
  end: number;
  start: number;
}

/**
 * Compute a zoom window around a time range with padding and safe bounds.
 * - Adds ~10 data points of context on each side based on intervalSeconds
 * - Clamps total span to <= 10k points and <= 90 days
 * - Aligns start/end to minute boundaries
 */
export function computeZoomRangeMs({
  startMs,
  endMs,
  intervalSeconds,
}: ComputeZoomRangeOptions): ZoomRangeMs {
  const intervalMs = Math.max((intervalSeconds ?? 60) * 1000, 60_000);
  const bufferMs = 10 * intervalMs;

  const desiredStart = startMs - bufferMs;
  const desiredEnd = endMs + bufferMs;

  const MAX_POINTS = 10_000;
  const pointsSpanMs = MAX_POINTS * intervalMs;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const maxSpanMs = Math.min(pointsSpanMs, ninetyDaysMs);

  let zoomStartMs = desiredStart;
  let zoomEndMs = desiredEnd;
  if (zoomEndMs - zoomStartMs > maxSpanMs) {
    zoomEndMs = desiredEnd;
    zoomStartMs = zoomEndMs - maxSpanMs;
  }

  const start = Math.floor(zoomStartMs / 60_000) * 60_000;
  const end = Math.ceil(zoomEndMs / 60_000) * 60_000;

  return {start, end};
}

/**
 * Build a query object that applies the zoom window to URL params.
 * Clears statsPeriod in favor of absolute start/end.
 */
export function buildDetectorZoomQuery(
  existingQuery: Record<string, any>,
  zoomStartMs: number,
  zoomEndMs: number
) {
  return {
    ...existingQuery,
    start: getUtcDateString(zoomStartMs),
    end: getUtcDateString(zoomEndMs),
    statsPeriod: undefined,
  };
}
