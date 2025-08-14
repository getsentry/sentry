import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';
import {parseVisualize, Visualize} from 'sentry/views/explore/queryParams/visualize';

export type WritableAggregateField = GroupBy | BaseVisualize;

export type AggregateField = GroupBy | Visualize;

export function getAggregateFieldsFromLocation(
  location: Location,
  key: string
): AggregateField[] | null {
  const rawAggregateFields = decodeList(location.query?.[key]);

  if (rawAggregateFields.length <= 0) {
    return null;
  }

  const aggregateFields = [];

  for (const rawAggregateField of rawAggregateFields) {
    let value: any;
    try {
      value = JSON.parse(rawAggregateField);
    } catch (error) {
      continue;
    }
    for (const aggregateField of parseAggregateField(value)) {
      aggregateFields.push(aggregateField);
    }
  }

  return aggregateFields;
}

function parseAggregateField(value: any): AggregateField[] {
  if (isGroupBy(value)) {
    return [value];
  }

  const visualizes = parseVisualize(value);
  if (visualizes.length) {
    return visualizes;
  }

  return [];
}
