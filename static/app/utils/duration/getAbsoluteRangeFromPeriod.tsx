import {HOUR} from 'sentry/utils/formatters';

import {parsePeriodToHours} from './parsePeriodToHours';

export function getAbsoluteRangeFromPeriod(
  period: string,
  now: number = Date.now()
): {end: Date; start: Date} | null {
  const hours = parsePeriodToHours(period);
  if (hours <= 0) {
    return null;
  }
  return {start: new Date(now - hours * HOUR), end: new Date(now)};
}
