import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {defaultGroupBys, getGroupBysFromLocation} from './groupBys';
import type {BaseVisualize} from './visualizes';
import {
  defaultVisualizes,
  getVisualizesFromLocation,
  parseBaseVisualize,
  Visualize,
} from './visualizes';

export interface GroupBy {
  groupBy: string;
}

export function isBaseVisualize(value: any): value is BaseVisualize {
  return (
    typeof value === 'object' &&
    Array.isArray(value.yAxes) &&
    value.yAxes.every((v: any) => typeof v === 'string') &&
    (!defined(value.chartType) || Object.values(ChartType).includes(value.chartType))
  );
}

export function isGroupBy(value: any): value is GroupBy {
  return typeof value === 'object' && typeof value.groupBy === 'string';
}

export function isVisualize(value: any): value is Visualize {
  return typeof value === 'object' && 'yAxis' in value && typeof value.yAxis === 'string';
}

export type BaseAggregateField = GroupBy | BaseVisualize;
export type AggregateField = GroupBy | Visualize;

export function defaultAggregateFields(): AggregateField[] {
  return [
    ...defaultGroupBys().map(groupBy => ({
      groupBy,
    })),
    ...defaultVisualizes(),
  ];
}

export function getAggregateFieldsFromLocation(
  location: Location,
  organization: Organization
): AggregateField[] {
  const rawAggregateFields = decodeList(location.query.aggregateField);

  if (!rawAggregateFields.length) {
    return [
      ...getGroupBysFromLocation(location).map(groupBy => ({
        groupBy,
      })),
      ...getVisualizesFromLocation(location, organization),
    ];
  }

  const parsed: Array<GroupBy | BaseVisualize | null> = rawAggregateFields.map(raw =>
    parseGroupByOrBaseVisualize(raw, organization)
  );

  let i = 0;

  const aggregateFields: AggregateField[] = [];

  let hasGroupBys = false;
  let hasVisualizes = false;

  for (const groupByOrBaseVisualize of parsed) {
    if (isGroupBy(groupByOrBaseVisualize)) {
      aggregateFields.push(groupByOrBaseVisualize);
      hasGroupBys = true;
    } else if (isBaseVisualize(groupByOrBaseVisualize)) {
      for (const yAxis of groupByOrBaseVisualize.yAxes) {
        aggregateFields.push(
          new Visualize(yAxis, {
            label: String.fromCharCode(65 + i), // starts from 'A',
            chartType: groupByOrBaseVisualize.chartType,
          })
        );
        i++;
        hasVisualizes = true;
      }
    }
  }

  if (!hasGroupBys) {
    aggregateFields.push(
      ...defaultGroupBys().map(groupBy => ({
        groupBy,
      }))
    );
  }

  if (!hasVisualizes) {
    aggregateFields.push(...defaultVisualizes());
  }

  return aggregateFields;
}

export function updateLocationWithAggregateFields(
  location: Location,
  aggregateFields: Array<GroupBy | BaseVisualize> | null | undefined
) {
  if (defined(aggregateFields)) {
    location.query.aggregateField = aggregateFields.flatMap(aggregateField => {
      if (isBaseVisualize(aggregateField)) {
        const visualizes = Visualize.fromJSON(aggregateField);
        return visualizes.map(visualize => JSON.stringify(visualize.toJSON()));
      }
      return [JSON.stringify(aggregateField)];
    });
  } else if (aggregateFields === null) {
    delete location.query.aggregateField;
  }
}

function parseGroupByOrBaseVisualize(
  raw: string,
  organization: Organization
): GroupBy | BaseVisualize | null {
  const groupBy = parseGroupBy(raw);
  if (defined(groupBy)) {
    return groupBy;
  }
  return parseBaseVisualize(raw, organization);
}

function parseGroupBy(raw: string): GroupBy | null {
  try {
    const parsed = JSON.parse(raw);
    if (!defined(parsed) || typeof parsed.groupBy !== 'string') {
      return null;
    }
    return {groupBy: parsed.groupBy};
  } catch (error) {
    return null;
  }
}
