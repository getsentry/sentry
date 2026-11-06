import moment from 'moment-timezone';

import type {DateTimeInput} from './format';

export function parseDate(date: DateTimeInput, timezone: string, locale: string) {
  if (
    !moment.tz.zone(timezone) ||
    (typeof date === 'string' && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(date)) ||
    (typeof date === 'number' && !Number.isFinite(date)) ||
    (typeof date !== 'string' && typeof date !== 'number' && !(date instanceof Date))
  ) {
    return null;
  }
  const value =
    typeof date === 'string'
      ? moment.parseZone(date, moment.ISO_8601, true).tz(timezone)
      : moment.tz(date, timezone);
  return value.isValid() ? value.locale(locale) : null;
}
