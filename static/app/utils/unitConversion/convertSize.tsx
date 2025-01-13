import {SIZE_UNIT_MULTIPLIERS, type SizeUnit} from '../discover/fields';

export function convertSize(value: number, fromUnit: SizeUnit, toUnit: SizeUnit): number {
  return (value * SIZE_UNIT_MULTIPLIERS[fromUnit]) / SIZE_UNIT_MULTIPLIERS[toUnit];
}
