import {parseStatsPeriod} from 'sentry/components/pageFilters/parse';

// the keys should match STATS_PERIODS in src/sentry/snuba/sessions.py
const STATS_PERIODS: Record<string, number> = {
  '1h': 3600,
  '24h': 86400,
  '1d': 86400,
  '48h': 172800,
  '2d': 172800,
  '7d': 604800,
  '14d': 1209600,
  '30d': 2592000,
  '90d': 7776000,
};

function parseStatsPeriodToSeconds(statsPeriod: string): number | null {
  const parsed = parseStatsPeriod(statsPeriod);
  if (!parsed) {
    return null;
  }

  const {period, periodLength} = parsed;
  const value = parseInt(period!, 10);

  switch (periodLength) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    case 'w':
      return value * 7 * 24 * 60 * 60;
    default:
      return null;
  }
}

/**
 * Validates a release summaryStatsPeriod string against the allowed values and returns the closest match.
 * The valid values are based on src/sentry/snuba/sessions.py. Invalid or undefined statsPeriods are defaulted to "7d".
 *
 * @param statsPeriod - A stats period string (e.g., "1h", "30m", "7d", "2w") to validate, or undefined
 * @returns A valid stats period string from STATS_PERIODS
 *
 * @example
 * validateSummaryStatsPeriod("1h") // returns "1h" (exact match)
 * validateSummaryStatsPeriod("45m") // returns "1h"
 * validateSummaryStatsPeriod("3d") // returns "2d"
 * validateSummaryStatsPeriod("invalid") // returns "7d"
 * validateSummaryStatsPeriod(undefined) // returns "7d"
 */
export function validateSummaryStatsPeriod(statsPeriod: string | undefined): string {
  const validStatsPeriods = Object.keys(STATS_PERIODS);

  if (!statsPeriod) {
    return '7d';
  }

  if (validStatsPeriods.includes(statsPeriod)) {
    return statsPeriod;
  }

  const inputSeconds = parseStatsPeriodToSeconds(statsPeriod);
  if (inputSeconds === null) {
    // if we can't parse the input, return 7d
    return '7d';
  }

  const closestPeriod = validStatsPeriods.reduce((closest, current) => {
    const currentDiff = Math.abs((STATS_PERIODS[current] ?? 0) - inputSeconds);
    const closestDiff = Math.abs((STATS_PERIODS[closest] ?? 0) - inputSeconds);
    return currentDiff < closestDiff ? current : closest;
  });

  return closestPeriod;
}
