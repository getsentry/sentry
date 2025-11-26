import {parseStatsPeriod} from 'sentry/components/organizations/pageFilters/parse';

// See MAX_ROLLUP_POINTS in sentry/constants.py
const DEFAULT_MAX_BUCKETS = 10000;

const INTERVAL_PRESETS_SECONDS = [
  60, // 1 minute
  300, // 5 minutes
  900, // 15 minutes
  1800, // 30 minutes
  3600, // 1 hour
  7200, // 2 hours
  14400, // 4 hours
  86400, // 1 day
] as const;

function getTimeRangeInSeconds({
  statsPeriod,
  start,
  end,
}: {
  end?: string | null;
  start?: string | null;
  statsPeriod?: string | null;
}): number {
  if (statsPeriod) {
    const parsed = parseStatsPeriod(statsPeriod);
    if (parsed?.period) {
      const {period, periodLength} = parsed;
      const value = parseInt(period, 10);
      const multipliers: Record<string, number> = {
        s: 1,
        m: 60,
        h: 60 * 60,
        d: 24 * 60 * 60,
        w: 7 * 24 * 60 * 60,
      };
      return value * (multipliers[periodLength] ?? 1);
    }
  }
  if (start && end) {
    return (new Date(end).getTime() - new Date(start).getTime()) / 1000;
  }
  return 0;
}

/**
 * Snaps a value to the smallest preset interval that is >= the given value.
 * Falls back to the largest preset if the value exceeds all presets.
 */
function snapToPresetInterval(minIntervalSeconds: number): number {
  for (const preset of INTERVAL_PRESETS_SECONDS) {
    if (preset >= minIntervalSeconds) {
      return preset;
    }
  }
  // If minInterval exceeds all presets, use the largest one (1 day)
  return INTERVAL_PRESETS_SECONDS.at(-1) ?? 86400;
}

interface GetChartIntervalOptions {
  timeRange: {
    end?: string | null;
    start?: string | null;
    statsPeriod?: string | null;
  };
  /**
   * The detector's configured time window in seconds.
   */
  timeWindow: number;
  maxBuckets?: number;
}

/**
 * Calculates the appropriate chart interval in seconds, ensuring we don't exceed
 * the maximum number of data points for the given dataset.
 *
 * The returned interval is:
 * 1. Calculated based on the time range and max data points
 * 2. Snapped to a preset value (1m, 5m, 15m, 30m, 1h, 2h, 4h, 1d)
 * 3. At least as large as the detector's configured time window
 */
export function getChartInterval({
  timeWindow,
  timeRange,
  maxBuckets = DEFAULT_MAX_BUCKETS,
}: GetChartIntervalOptions): number {
  const timeRangeSeconds = getTimeRangeInSeconds(timeRange);
  if (timeRangeSeconds <= 0) {
    return timeWindow;
  }

  const rawMinInterval = Math.ceil(timeRangeSeconds / maxBuckets);
  const snappedInterval = snapToPresetInterval(rawMinInterval);

  return Math.max(timeWindow, snappedInterval);
}
