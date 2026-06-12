import {defined} from 'sentry/utils/defined';

/**
 * A threshold has a value if it is not one of the following:
 *
 * '', null, undefined
 *
 *
 */
export function hasThresholdValue(value: number | '' | null): value is number {
  return defined(value) && value !== '';
}
