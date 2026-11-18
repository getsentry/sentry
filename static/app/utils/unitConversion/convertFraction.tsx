import {FRACTION_UNIT_MULTIPLIERS, type FractionUnit} from 'sentry/utils/discover/fields';

export function convertFraction(
  value: number,
  fromUnit: FractionUnit,
  toUnit: FractionUnit
): number {
  return (
    value * (FRACTION_UNIT_MULTIPLIERS[fromUnit] / FRACTION_UNIT_MULTIPLIERS[toUnit])
  );
}
