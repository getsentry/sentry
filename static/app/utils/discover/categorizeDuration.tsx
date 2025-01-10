import {
  DAY,
  HOUR,
  MICROSECOND,
  MILLISECOND,
  MINUTE,
  SECOND,
  WEEK,
} from 'sentry/utils/formatters';

/**
 * Categorizes the duration by Second, Minute, Hour, etc
 * e.g., categorizeDuration(1200) = MINUTE
 * @param value Duration in ms
 */
export function categorizeDuration(value): number {
  if (value >= WEEK) {
    return WEEK;
  }
  if (value >= DAY) {
    return DAY;
  }
  if (value >= HOUR) {
    return HOUR;
  }
  if (value >= MINUTE) {
    return MINUTE;
  }
  if (value >= SECOND) {
    return SECOND;
  }
  if (value >= MILLISECOND) {
    return MILLISECOND;
  }

  return MICROSECOND;
}
