import isDate from 'lodash/isDate';
import isEqualWith from 'lodash/isEqualWith';

// `lodash.isEqual` does not compare date objects
function dateComparator(value: any, other: any): boolean | undefined {
  if (isDate(value) && isDate(other)) {
    return +value === +other;
  }

  // Loose checking
  if (!value && !other) {
    return true;
  }

  // returning undefined will use default comparator
  return undefined;
}

export const isEqualWithDates = (a: any, b: any) => isEqualWith(a, b, dateComparator);
