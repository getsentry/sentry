import zipWith from 'lodash/zipWith';

import type {TimeSeriesGroupBy} from 'sentry/views/dashboards/widgets/common/types';

export function parseGroupBy(
  groupName: string,
  fields: string[]
): TimeSeriesGroupBy[] | undefined {
  if (groupName === 'Other') {
    return undefined;
  }

  const groupKeys = fields;
  const groupValues = groupName.split(',');

  // The number of keys and values should be the same in all cases, if they're
  // not, something went majorly wrong, and we should bail
  if (groupKeys.length !== groupValues.length) {
    return undefined;
  }

  return zipWith(groupKeys, groupValues, (key, value) => {
    return {key, value};
  });
}
