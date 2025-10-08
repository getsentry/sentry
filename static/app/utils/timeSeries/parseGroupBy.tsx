import zipWith from 'lodash/zipWith';

import type {TimeSeriesGroupBy} from 'sentry/views/dashboards/widgets/common/types';

export function parseGroupBy(
  groupName: string,
  fields: string[]
): TimeSeriesGroupBy[] | null {
  if (groupName === 'Other') {
    return null;
  }

  const groupKeys = fields;
  const groupValues = groupName.split(',');

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
