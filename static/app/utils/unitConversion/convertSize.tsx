import {SIZE_UNIT_MULTIPLIERS} from 'sentry/utils/discover/fields';
import {type SizeUnit} from 'sentry/utils/discover/fieldsBase';

export function convertSize(value: number, fromUnit: SizeUnit, toUnit: SizeUnit): number {
  return value * (SIZE_UNIT_MULTIPLIERS[fromUnit] / SIZE_UNIT_MULTIPLIERS[toUnit]);
}
