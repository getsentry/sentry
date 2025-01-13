import {RATE_UNIT_MULTIPLIERS, type RateUnit} from '../discover/fields';

export function convertRate(value: number, fromUnit: RateUnit, toUnit: RateUnit): number {
  return (value / RATE_UNIT_MULTIPLIERS[fromUnit]) * RATE_UNIT_MULTIPLIERS[toUnit];
}
