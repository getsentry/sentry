import type {Location} from 'history';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  ALLOWED_EXPLORE_VISUALIZE_FIELDS,
  NO_ARGUMENT_SPAN_AGGREGATES,
} from 'sentry/utils/fields';
import {decodeList} from 'sentry/utils/queryString';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {SpanIndexedField} from 'sentry/views/insights/types';

export const MAX_VISUALIZES = 4;

export const DEFAULT_VISUALIZATION_AGGREGATE = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES[0]!;
export const DEFAULT_VISUALIZATION_FIELD = ALLOWED_EXPLORE_VISUALIZE_FIELDS[0]!;
export const DEFAULT_VISUALIZATION = `${DEFAULT_VISUALIZATION_AGGREGATE}(${DEFAULT_VISUALIZATION_FIELD})`;

export function defaultVisualizes(): Visualize[] {
  return [new Visualize(DEFAULT_VISUALIZATION, {label: 'A'})];
}

type VisualizeOptions = {
  chartType?: ChartType;
  label?: string;
};

export interface BaseVisualize {
  yAxes: readonly string[];
  chartType?: ChartType;
}

export class Visualize {
  chartType: ChartType;
  label: string;
  yAxis: string;
  stack?: string;
  private selectedChartType?: ChartType;

  constructor(yAxis: string, options?: VisualizeOptions) {
    this.yAxis = yAxis;
    this.label = options?.label || '';
    this.selectedChartType = options?.chartType;
    this.chartType = this.selectedChartType ?? determineDefaultChartType([yAxis]);
    this.stack = 'all';
  }

  clone(): Visualize {
    return new Visualize(this.yAxis, {
      label: this.label,
      chartType: this.selectedChartType,
    });
  }

  replace({chartType, yAxis}: {chartType?: ChartType; yAxis?: string}): Visualize {
    return new Visualize(yAxis ?? this.yAxis, {
      label: this.label,
      chartType: chartType ?? this.selectedChartType,
    });
  }

  toJSON(): BaseVisualize {
    const json: BaseVisualize = {
      yAxes: [this.yAxis],
    };

    if (defined(this.selectedChartType)) {
      json.chartType = this.selectedChartType;
    }

    return json;
  }

  static fromJSON(json: BaseVisualize): Visualize[] {
    return json.yAxes.map(
      yAxis => new Visualize(yAxis, {label: '', chartType: json.chartType})
    );
  }
}

export function getVisualizesFromLocation(
  location: Location,
  organization: Organization
): Visualize[] {
  const rawVisualizes = decodeList(location.query.visualize);

  const visualizes: Visualize[] = [];

  const baseVisualizes: BaseVisualize[] = rawVisualizes
    .map(raw => parseBaseVisualize(raw, organization))
    .filter(defined);

  let i = 0;
  for (const visualize of baseVisualizes) {
    for (const yAxis of visualize.yAxes) {
      visualizes.push(
        new Visualize(yAxis, {
          label: String.fromCharCode(65 + i), // starts from 'A',
          chartType: visualize.chartType,
        })
      );
      i++;
    }
  }

  return visualizes.length ? visualizes : defaultVisualizes();
}

export function parseBaseVisualize(
  raw: string,
  organization: Organization
): BaseVisualize | null {
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

    const visualize: BaseVisualize = {yAxes};

    const chartType = Number(parsed.chartType);
    if (Object.values(ChartType).includes(chartType)) {
      visualize.chartType = chartType;
    }

    return visualize;
  } catch (error) {
    return null;
  }
}

export function updateVisualizeAggregate({
  newAggregate,
  oldAggregate,
  oldArgument,
}: {
  newAggregate: string;
  oldAggregate?: string;
  oldArgument?: string;
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
    return `${newAggregate}(${SpanIndexedField.SPAN_OP})`;
  }

  if (NO_ARGUMENT_SPAN_AGGREGATES.includes(newAggregate as AggregationKey)) {
    return `${newAggregate}()`;
  }

  // switching away from count_unique means we need to reset the field
  if (
    oldAggregate === AggregationKey.COUNT_UNIQUE ||
    NO_ARGUMENT_SPAN_AGGREGATES.includes(oldAggregate as AggregationKey)
  ) {
    return `${newAggregate}(${DEFAULT_VISUALIZATION_FIELD})`;
  }

  return `${newAggregate}(${oldArgument})`;
}

const FUNCTION_TO_CHART_TYPE: Record<string, ChartType> = {
  [AggregationKey.COUNT]: ChartType.BAR,
  [AggregationKey.COUNT_UNIQUE]: ChartType.BAR,
  [AggregationKey.SUM]: ChartType.BAR,
};

export function determineDefaultChartType(yAxes: readonly string[]): ChartType {
  const counts: Record<ChartType, number> = {
    [ChartType.BAR]: 0,
    [ChartType.LINE]: 0,
    [ChartType.AREA]: 0,
  };

  for (const yAxis of yAxes) {
    const func = parseFunction(yAxis);
    if (!defined(func)) {
      continue;
    }
    const chartType = FUNCTION_TO_CHART_TYPE[func.name] ?? ChartType.LINE;
    counts[chartType] += 1;
  }

  return [ChartType.AREA, ChartType.BAR, ChartType.LINE].reduce(
    (acc, ct) => (counts[ct] >= counts[acc] ? ct : acc),
    ChartType.AREA
  );
}
