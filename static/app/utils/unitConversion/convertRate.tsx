import {RATE_UNIT_MULTIPLIERS, type RateUnit} from 'sentry/utils/discover/fields';

export function convertRate(value: number, fromUnit: RateUnit, toUnit: RateUnit): number {
  return value * (RATE_UNIT_MULTIPLIERS[fromUnit] / RATE_UNIT_MULTIPLIERS[toUnit]);
}
