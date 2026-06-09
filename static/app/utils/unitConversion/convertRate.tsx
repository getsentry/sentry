import {RATE_UNIT_MULTIPLIERS} from 'sentry/utils/discover/fields';
import {type RateUnit} from 'sentry/utils/discover/fieldsBase';

export function convertRate(value: number, fromUnit: RateUnit, toUnit: RateUnit): number {
  return value * (RATE_UNIT_MULTIPLIERS[fromUnit] / RATE_UNIT_MULTIPLIERS[toUnit]);
}
