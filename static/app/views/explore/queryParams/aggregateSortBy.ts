import type {Location} from 'history';

import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';

export function getAggregateSortBysFromLocation(
  location: Location,
  key: string,
  aggregateFields: AggregateField[]
): Sort[] | null {
  const sortBys = decodeSorts(location.query?.[key]);

  if (sortBys.length > 0) {
    if (sortBys.every(sort => validateAggregateSort(sort, aggregateFields))) {
      return sortBys;
    }
  }

  return null;
}

export function validateAggregateSort(
  sort: Sort,
  aggregateFields: AggregateField[]
): boolean {
  return aggregateFields.some(aggregateField => {
    if (isGroupBy(aggregateField)) {
      return aggregateField.groupBy === sort.field;
    }

    if (isVisualize(aggregateField)) {
      return aggregateField.yAxis === sort.field;
    }

    throw new Error('Unknown aggregate field');
  });
}
