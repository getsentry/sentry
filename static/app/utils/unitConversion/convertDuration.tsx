import {DURATION_UNIT_MULTIPLIERS, type DurationUnit} from '../discover/fields';

export function convertDuration(
  value: number,
  fromUnit: DurationUnit,
  toUnit: DurationUnit
): number {
  return (
    value * (DURATION_UNIT_MULTIPLIERS[fromUnit] / DURATION_UNIT_MULTIPLIERS[toUnit])
  );
}
