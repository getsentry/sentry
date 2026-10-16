import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {
  BaseVisualize,
  ParseVisualizeOptions,
} from 'sentry/views/explore/queryParams/visualize';
import {
  isVisualize,
  parseVisualize,
  serializeVisualizes,
  Visualize,
} from 'sentry/views/explore/queryParams/visualize';

export type WritableAggregateField = GroupBy | BaseVisualize;

export type AggregateField = GroupBy | Visualize;

export function serializeAggregateField(
  aggregateField: AggregateField
): WritableAggregateField {
  if (isGroupBy(aggregateField)) {
    return aggregateField;
  }
  return aggregateField.serialize();
}

/**
 * Serializes aggregate fields, merging adjacent visualizes that share a chart
 * group into a single entry so the group is preserved.
 */
export function serializeAggregateFields(
  aggregateFields: readonly AggregateField[]
): WritableAggregateField[] {
  const serialized: WritableAggregateField[] = [];
  let pendingVisualizes: Visualize[] = [];

  const flushVisualizes = () => {
    serialized.push(...serializeVisualizes(pendingVisualizes));
    pendingVisualizes = [];
  };

  for (const aggregateField of aggregateFields) {
    if (isVisualize(aggregateField)) {
      pendingVisualizes.push(aggregateField);
    } else {
      flushVisualizes();
      serialized.push(aggregateField);
    }
  }
  flushVisualizes();

  return serialized;
}

export function getAggregateFieldsFromLocation(
  location: Location,
  key: string,
  options?: ParseVisualizeOptions
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
    for (const aggregateField of parseAggregateField(value, options)) {
      aggregateFields.push(aggregateField);
    }
  }

  return aggregateFields;
}

function parseAggregateField(
  value: any,
  options?: ParseVisualizeOptions
): AggregateField[] {
  if (isGroupBy(value)) {
    return [value];
  }

  const visualizes = parseVisualize(value, options);
  if (visualizes.length) {
    return visualizes;
  }

  return [];
}
