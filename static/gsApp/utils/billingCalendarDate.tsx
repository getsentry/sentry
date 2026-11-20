import {Temporal} from '@js-temporal/polyfill';

export function billingCalendarDateToTimestamp(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NaN;
  }
  try {
    return Temporal.PlainDate.from(date).toZonedDateTime('UTC').epochMilliseconds;
  } catch (error) {
    if (error instanceof RangeError) {
      return NaN;
    }
    throw error;
  }
}
