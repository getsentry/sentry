import type {Location} from 'history';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  ALLOWED_EXPLORE_VISUALIZE_FIELDS,
} from 'sentry/utils/fields';
import {decodeList} from 'sentry/utils/queryString';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {SpanIndexedField} from 'sentry/views/insights/types';

export const MAX_VISUALIZES = 4;

export const DEFAULT_VISUALIZATION_AGGREGATE = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES[0]!;
export const DEFAULT_VISUALIZATION_FIELD = ALLOWED_EXPLORE_VISUALIZE_FIELDS[0]!;
export const DEFAULT_VISUALIZATION = `${DEFAULT_VISUALIZATION_AGGREGATE}(${DEFAULT_VISUALIZATION_FIELD})`;

export function defaultVisualizes(): Visualize[] {
  return [
    {
      chartType: ChartType.BAR,
      yAxes: [DEFAULT_VISUALIZATION],
      label: 'A',
    },
  ];
}

export interface BaseVisualize {
  chartType: ChartType;
  yAxes: string[];
}

export interface Visualize extends BaseVisualize {
  label: string;
}

export function getVisualizesFromLocation(
  location: Location,
  organization: Organization
): Visualize[] {
  const rawVisualizes = decodeList(location.query.visualize);

  const result: Visualize[] = rawVisualizes
    .map(raw => parseVisualizes(raw, organization))
    .filter(defined)
    .filter(parsed => parsed.yAxes.length > 0)
    .map((parsed, i) => {
      return {
        chartType: parsed.chartType,
        yAxes: parsed.yAxes,
        label: String.fromCharCode(65 + i), // starts from 'A'
      };
    });

  return result.length ? result : defaultVisualizes();
}

function parseVisualizes(raw: string, organization: Organization): BaseVisualize | null {
  try {
    const parsed = JSON.parse(raw);
    if (!defined(parsed) || !Array.isArray(parsed.yAxes)) {
      return null;
    }

    const yAxes = organization.features.includes('visibility-explore-equations')
      ? parsed.yAxes.filter((yAxis: string) => {
          const expression = new Expression(yAxis);
          return expression.isValid;
        })
      : parsed.yAxes.filter(parseFunction);
    if (yAxes.length <= 0) {
      return null;
    }

    let chartType = Number(parsed.chartType);
    if (isNaN(chartType) || !Object.values(ChartType).includes(chartType)) {
      chartType = ChartType.LINE;
    }

    return {yAxes, chartType};
  } catch (error) {
    return null;
  }
}

export function updateLocationWithVisualizes(
  location: Location,
  visualizes: BaseVisualize[] | null | undefined
) {
  if (defined(visualizes)) {
    location.query.visualize = visualizes.map(visualize =>
      JSON.stringify({
        chartType: visualize.chartType,
        yAxes: visualize.yAxes,
      })
    );
  } else if (visualizes === null) {
    delete location.query.visualize;
  }
}

export function updateVisualizeAggregate({
  newAggregate,
  oldAggregate,
  oldArgument,
}: {
  newAggregate: string;
  oldAggregate: string;
  oldArgument: string;
}): string {
  // the default aggregate only has 1 allowed field
  if (newAggregate === DEFAULT_VISUALIZATION_AGGREGATE) {
    return DEFAULT_VISUALIZATION;
  }

  // count_unique uses a different set of fields
  if (newAggregate === AggregationKey.COUNT_UNIQUE) {
    // The general thing to do here is to valid the the argument type
    // and carry the argument if it's the same type, reset to a default
    // if it's not the same type. Just hard coding it for now for simplicity
    // as `count_unique` is the only aggregate that takes a string.
    return `${AggregationKey.COUNT_UNIQUE}(${SpanIndexedField.SPAN_OP})`;
  }

  // switching away from count_unique means we need to reset the field
  if (oldAggregate === AggregationKey.COUNT_UNIQUE) {
    return `${newAggregate}(${DEFAULT_VISUALIZATION_FIELD})`;
  }

  return `${newAggregate}(${oldArgument})`;
}
