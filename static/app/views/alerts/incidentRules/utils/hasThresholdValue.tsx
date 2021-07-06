import {defined} from 'app/utils';

/**
 * A threshold has a value if it is not one of the following:
 *
 * '', null, undefined
 *
 *
 */
export default function hasThresholdValue(value: number | '' | null): value is number {
  return defined(value) && value !== '';
}
