import {defined} from 'sentry/utils/defined';
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
 * Serializes aggregate fields, merging the visualizes that share a chart group
 * into a single entry so the group is preserved.
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

  for (const aggregateField of gatherChartGroups(aggregateFields)) {
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

/**
 * A chart group can only be written as one entry, so its members must be
 * adjacent. Editing a member out of the middle of a group, e.g. in the table
 * editor, leaves the others apart. Moving them back next to the first member
 * keeps them on one chart instead of splitting them into a chart each.
 */
function gatherChartGroups(aggregateFields: readonly AggregateField[]): AggregateField[] {
  const gathered: AggregateField[] = [];
  const seenChartGroups = new Set<string>();

  for (const aggregateField of aggregateFields) {
    if (!isVisualize(aggregateField) || !defined(aggregateField.chartGroup)) {
      gathered.push(aggregateField);
      continue;
    }

    const {chartGroup} = aggregateField;
    if (seenChartGroups.has(chartGroup)) {
      continue;
    }
    seenChartGroups.add(chartGroup);
    gathered.push(
      ...aggregateFields.filter(
        field => isVisualize(field) && field.chartGroup === chartGroup
      )
    );
  }

  return gathered;
}

export function getAggregateFields(
  rawAggregateFields: readonly string[],
  options?: ParseVisualizeOptions
): AggregateField[] | null {
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
