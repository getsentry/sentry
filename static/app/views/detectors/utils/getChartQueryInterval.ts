import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

interface GetChartQueryIntervalOptions {
  /**
   * The detector's time window in seconds (e.g. 3600 for 1 hour)
   */
  timeWindow: number;
  end?: string | null;
  start?: string | null;
  statsPeriod?: string | null;
}

interface ChartQueryInterval {
  /**
   * The finer query interval in seconds to pass to the API
   */
  queryInterval: number;
  /**
   * Number of data points to include in each rolling window computation.
   * When <= 1, no rolling window is needed.
   */
  windowSize: number;
}

const MAX_DATA_POINTS = 10000;
const MIN_INTERVAL = 60;

/**
 * Gets the divisors of a number in ascending order,
 * filtered to only include divisors >= the given minimum.
 */
function getDivisors(n: number, min: number): number[] {
  const divisors: number[] = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      if (i >= min) {
        divisors.push(i);
      }
      const complement = n / i;
      if (complement !== i && complement >= min) {
        divisors.push(complement);
      }
    }
  }
  return divisors.sort((a, b) => a - b);
}

/**
 * Computes the time range in seconds from either a stats period string
 * or absolute start/end dates.
 */
function getTimeRangeSeconds({
  statsPeriod,
  start,
  end,
}: Pick<GetChartQueryIntervalOptions, 'statsPeriod' | 'start' | 'end'>): number {
  if (statsPeriod) {
    const hours = parsePeriodToHours(statsPeriod);
    if (hours > 0) {
      return hours * 3600;
    }
  }

  if (start && end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (!isNaN(startMs) && !isNaN(endMs)) {
      return (endMs - startMs) / 1000;
    }
  }

  // Default to 24 hours
  return 86400;
}

/**
 * Determines the optimal query interval for fetching chart data at a finer
 * granularity than the detector's time window, enabling rolling window
 * computation on the frontend that matches the backend's evaluation behavior.
 *
 * The query interval is chosen as a divisor of the time window to ensure
 * the rolling window computation aligns exactly with the detector's
 * evaluation boundaries.
 */
export function getChartQueryInterval({
  timeWindow,
  statsPeriod,
  start,
  end,
}: GetChartQueryIntervalOptions): ChartQueryInterval {
  const timeRangeSeconds = getTimeRangeSeconds({statsPeriod, start, end});

  // Get divisors of timeWindow >= 60s in ascending order
  const divisors = getDivisors(timeWindow, MIN_INTERVAL);

  // Find the smallest divisor (finest interval) that keeps data points under the threshold
  for (const divisor of divisors) {
    const dataPoints = timeRangeSeconds / divisor;
    if (dataPoints <= MAX_DATA_POINTS) {
      return {
        queryInterval: divisor,
        windowSize: timeWindow / divisor,
      };
    }
  }

  // If no divisor works (very unlikely), use the time window itself
  return {
    queryInterval: timeWindow,
    windowSize: 1,
  };
}
