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
  return [new Visualize([DEFAULT_VISUALIZATION], 'A')];
}

export interface BaseVisualize {
  yAxes: readonly string[];
  chartType?: ChartType;
}

export class Visualize {
  chartType: ChartType;
  label: string;
  yAxes: readonly string[];
  private selectedChartType?: ChartType;

  constructor(yAxes: readonly string[], label = '', chartType?: ChartType) {
    this.label = label;
    this.yAxes = yAxes;
    this.selectedChartType = chartType;
    this.chartType = this.selectedChartType ?? determineDefaultChartType(this.yAxes);
  }

  clone(): Visualize {
    return new Visualize(this.yAxes, this.label, this.selectedChartType);
  }

  replace({chartType, yAxes}: {chartType?: ChartType; yAxes?: string[]}): Visualize {
    return new Visualize(
      yAxes ?? this.yAxes,
      this.label,
      chartType ?? this.selectedChartType
    );
  }

  toJSON(): BaseVisualize {
    const json: BaseVisualize = {
      yAxes: this.yAxes,
    };

    if (defined(this.selectedChartType)) {
      json.chartType = this.selectedChartType;
    }

    return json;
  }

  static fromJSON(json: BaseVisualize): Visualize {
    return new Visualize(json.yAxes, '', json.chartType);
  }
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
      return new Visualize(
        parsed.yAxes,
        String.fromCharCode(65 + i), // starts from 'A'
        parsed.chartType
      );
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

export function updateLocationWithVisualizes(
  location: Location,
  visualizes: BaseVisualize[] | null | undefined
) {
  if (defined(visualizes)) {
    location.query.visualize = visualizes.map(visualize => {
      return JSON.stringify(Visualize.fromJSON(visualize).toJSON());
    });
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

const FUNCTION_TO_CHART_TYPE: Record<string, ChartType> = {
  [AggregationKey.COUNT]: ChartType.BAR,
  [AggregationKey.COUNT_UNIQUE]: ChartType.BAR,
  [AggregationKey.SUM]: ChartType.BAR,
};

function determineDefaultChartType(yAxes: readonly string[]): ChartType {
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
