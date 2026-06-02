import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {defaultGroupBys, isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';
import {
  isVisualize,
  parseVisualize,
  Visualize,
} from 'sentry/views/explore/queryParams/visualize';

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

export function parseAggregateField(value: any): AggregateField[] {
  if (isGroupBy(value)) {
    return [value];
  }

  const visualizes = parseVisualize(value);
  if (visualizes.length) {
    return visualizes;
  }

  return [];
}

export function normalizeAggregateFields(
  aggregateFields: readonly any[]
): AggregateField[] {
  return aggregateFields.flatMap(aggregateField => {
    if (isGroupBy(aggregateField) || isVisualize(aggregateField)) {
      return [aggregateField];
    }

    return parseAggregateField(aggregateField);
  });
}

export function withRequiredAggregateFields(
  aggregateFields: AggregateField[],
  getDefaultVisualizes: () => readonly Visualize[]
): AggregateField[] {
  let hasGroupBy = false;
  let hasVisualize = false;
  for (const aggregateField of aggregateFields) {
    if (isGroupBy(aggregateField)) {
      hasGroupBy = true;
    } else if (isVisualize(aggregateField)) {
      hasVisualize = true;
    }
  }

  if (!hasGroupBy) {
    aggregateFields.push(...defaultGroupBys());
  }

  if (!hasVisualize) {
    aggregateFields.push(...getDefaultVisualizes());
  }

  return aggregateFields;
}
