import isDate from 'lodash/isDate';

import isEqualWith from 'lodash/isEqualWith';

// `lodash.isEqual` does not compare date objects
const dateComparator = (value, other) => {
  if (isDate(value) && isDate(other)) {
    return +value === +other;
  }

  // Loose checking
  if (!value && !other) {
    return true;
  }

  // returning undefined will use default comparator
  return undefined;
};

export const isEqualWithDates = (a, b) => isEqualWith(a, b, dateComparator);
