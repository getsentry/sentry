import {DURATION_UNIT_MULTIPLIERS} from 'sentry/utils/discover/fields';
import {type DurationUnit} from 'sentry/utils/discover/fieldsBase';

export function convertDuration(
  value: number,
  fromUnit: DurationUnit,
  toUnit: DurationUnit
): number {
  return (
    value * (DURATION_UNIT_MULTIPLIERS[fromUnit] / DURATION_UNIT_MULTIPLIERS[toUnit])
  );
}
