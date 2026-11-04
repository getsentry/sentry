import {Temporal} from '@js-temporal/polyfill';

import type {DateTimeInput} from './format';

export function parseDate(date: DateTimeInput, timezone: string) {
  if (typeof date !== 'string' && typeof date !== 'number' && !(date instanceof Date)) {
    return null;
  }
  try {
    const instant =
      typeof date === 'string'
        ? Temporal.Instant.from(date)
        : Temporal.Instant.fromEpochMilliseconds(
            Math.trunc(date instanceof Date ? date.getTime() : date)
          );
    return instant.toZonedDateTimeISO(timezone);
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}
