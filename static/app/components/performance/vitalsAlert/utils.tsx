import {SENTRY_CUSTOMERS} from './constants';
import type {VitalsKey, VitalsResult} from './types';

export function getRelativeDiff(value: number, benchmark: number) {
  // get the difference and divide it by our benchmark
  return (value - benchmark) / benchmark;
}

export function getWorstVital(data: VitalsResult): VitalsKey | null {
  let worstField: VitalsKey | null = null;
  let worstDecrease = 0;
  for (const field in data) {
    const value = data[field];
    if (value) {
      const benchmark = SENTRY_CUSTOMERS[field];
      const relativeDiff = getRelativeDiff(value, benchmark);
      if (relativeDiff > worstDecrease) {
        worstDecrease = relativeDiff;
        worstField = field as VitalsKey;
      }
    }
  }
  if (worstDecrease > 0) {
    return worstField;
  }
  return null;
}

export function getCountParameterName(vital: VitalsKey) {
  switch (vital) {
    case 'FCP':
      return 'fcpCount';
    case 'LCP':
      return 'lcpCount';
    case 'appStartCold':
      return 'appColdStartCount';
    case 'appStartWarm':
      return 'appWarmStartCount';
    default:
      throw new Error(`Unexpected vital ${vital}`);
  }
}
