import zipWith from 'lodash/zipWith';

import type {TimeSeriesGroupBy} from 'sentry/views/dashboards/widgets/common/types';

export function parseGroupBy(
  groupName: string,
  fields: string[]
): TimeSeriesGroupBy[] | null {
  if (groupName === 'Other') {
    return null;
  }

  if (fields.length === 0) {
    return null;
  }

  const groupKeys = fields;
  const groupValues = groupName.split(DELIMITER);

  // If the `groupName` contains commas, that will result in more values than
  // keys. In this case, concatenate the values back together until the number
  // of keys and values matches. Do this greedily, which is not always accurate,
  // but in practice this doesn't make a UI difference since all values are
  // eventually concatenated with commas.
  while (groupValues.length > groupKeys.length) {
    groupValues.splice(0, 2, `${groupValues[0]!}${DELIMITER}${groupValues[1]!}`);
  }

  const groupBys = zipWith(groupKeys, groupValues, (key, value) => {
    return {
      key: key ?? '',
      value: value ?? '',
    };
  }).filter(groupBy => {
    return groupBy.key || groupBy.value;
  });

  return groupBys.length > 0 ? groupBys : null;
}

const DELIMITER = ',';
