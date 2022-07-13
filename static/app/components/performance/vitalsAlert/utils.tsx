import {SENTRY_CUSTOMERS} from './constants';
import {VitalsKey, VitalsResult} from './types';

export function getRelativeDiff(value: number, benchmark: number) {
  // get the difference and divide it by our benchmark
  return (value - benchmark) / benchmark;
}

export function getWorstVital(data: VitalsResult) {
  let worstField: VitalsKey | null = null;
  let worstDecrease = 0;
  let field: VitalsKey;
  for (field in data) {
    const value = data[field];
    if (value) {
      const benchmark = SENTRY_CUSTOMERS[field];
      const relativeDiff = getRelativeDiff(value, benchmark);
      if (relativeDiff > worstDecrease) {
        worstDecrease = relativeDiff;
        worstField = field;
      }
    }
  }
  if (worstDecrease > 0) {
    return worstField;
  }
  return null;
}
