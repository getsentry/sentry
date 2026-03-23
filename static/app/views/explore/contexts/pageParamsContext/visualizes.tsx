import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {defined} from 'sentry/utils';
import {
  isEquation,
  parseFunction,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  ALLOWED_EXPLORE_VISUALIZE_FIELDS,
  getFieldDefinition,
  NO_ARGUMENT_SPAN_AGGREGATES,
} from 'sentry/utils/fields';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {SpanFields} from 'sentry/views/insights/types';

export const DEFAULT_VISUALIZATION_AGGREGATE = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES[0]!;
export const DEFAULT_VISUALIZATION_FIELD = ALLOWED_EXPLORE_VISUALIZE_FIELDS[0]!;
export const DEFAULT_VISUALIZATION = `${DEFAULT_VISUALIZATION_AGGREGATE}(${DEFAULT_VISUALIZATION_FIELD})`;

type VisualizeOptions = {
  chartType?: ChartType;
};

export interface BaseVisualize {
  yAxes: readonly string[];
  chartType?: ChartType;
}

export class Visualize {
  isEquation: boolean;
  chartType: ChartType;
  yAxis: string;
  stack?: string;
  selectedChartType?: ChartType;

  constructor(yAxis: string, options?: VisualizeOptions) {
    this.yAxis = yAxis;
    this.selectedChartType = options?.chartType;
    this.isEquation = isEquation(yAxis);
    this.chartType = this.selectedChartType ?? determineDefaultChartType([yAxis]);
    this.stack = 'all';
  }

  isValid(): boolean {
    if (this.isEquation) {
      const expression = new Expression(stripEquationPrefix(this.yAxis));
      return expression.isValid;
    }
    return defined(parseFunction(this.yAxis));
  }

  clone(): Visualize {
    return new Visualize(this.yAxis, {
      chartType: this.selectedChartType,
    });
  }

  replace({chartType, yAxis}: {chartType?: ChartType; yAxis?: string}): Visualize {
    return new Visualize(yAxis ?? this.yAxis, {
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
    return json.yAxes.map(yAxis => new Visualize(yAxis, {chartType: json.chartType}));
  }
}

export function updateVisualizeAggregate({
  newAggregate,
  oldAggregate,
  oldArguments,
}: {
  newAggregate: string;
  oldAggregate?: string;
  oldArguments?: string[];
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
    return `${newAggregate}(${SpanFields.SPAN_OP})`;
  }

  if (NO_ARGUMENT_SPAN_AGGREGATES.includes(newAggregate as AggregationKey)) {
    return `${newAggregate}()`;
  }

  const newFieldDefinition = getFieldDefinition(newAggregate, 'span');
  const oldFieldDefinition = oldAggregate
    ? getFieldDefinition(oldAggregate, 'span')
    : undefined;

  if (newFieldDefinition?.parameters?.length !== oldFieldDefinition?.parameters?.length) {
    const params = newFieldDefinition?.parameters?.map(p => p.defaultValue || '');
    return `${newAggregate}(${params?.join(',')})`;
  }

  // switching away from count_unique means we need to reset the field
  if (
    oldAggregate === AggregationKey.COUNT_UNIQUE ||
    NO_ARGUMENT_SPAN_AGGREGATES.includes(oldAggregate as AggregationKey)
  ) {
    return `${newAggregate}(${DEFAULT_VISUALIZATION_FIELD})`;
  }

  return oldArguments
    ? `${newAggregate}(${oldArguments?.join(',')})`
    : `${newAggregate}()`;
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
