import type {Location} from 'history';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {defined} from 'sentry/utils';
import {
  isEquation,
  parseFunction,
  stripEquationPrefix,
  type ParsedFunction,
} from 'sentry/utils/discover/fields';
import {decodeList} from 'sentry/utils/queryString';
import {determineDefaultChartType} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';

interface VisualizeOptions {
  chartType?: ChartType;
}

export abstract class Visualize {
  readonly yAxis: string;
  readonly chartType: ChartType;
  readonly selectedChartType?: ChartType;
  abstract readonly kind: 'function' | 'equation';

  constructor(yAxis: string, options?: VisualizeOptions) {
    this.yAxis = yAxis;
    this.selectedChartType = options?.chartType;
    this.chartType = this.selectedChartType ?? determineDefaultChartType([yAxis]);
  }

  abstract clone(): Visualize;
  abstract replace({
    chartType,
    yAxis,
  }: {
    chartType?: ChartType;
    yAxis?: string;
  }): Visualize;

  static fromJSON(json: BaseVisualize): Visualize[] {
    return json.yAxes.map(yAxis => {
      if (isEquation(yAxis)) {
        return new VisualizeEquation(yAxis, {chartType: json.chartType});
      }
      return new VisualizeFunction(yAxis, {chartType: json.chartType});
    });
  }
}

export class VisualizeFunction extends Visualize {
  readonly kind = 'function';
  readonly parsedFunction: ParsedFunction | null;

  constructor(yAxis: string, options?: VisualizeOptions) {
    super(yAxis, options);
    this.parsedFunction = parseFunction(yAxis);
  }

  clone(): Visualize {
    return new VisualizeFunction(this.yAxis, {
      chartType: this.selectedChartType,
    });
  }

  replace({chartType, yAxis}: {chartType?: ChartType; yAxis?: string}): Visualize {
    return new VisualizeFunction(yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
    });
  }
}

class VisualizeEquation extends Visualize {
  readonly kind = 'equation';
  readonly expression: Expression;

  constructor(yAxis: string, options?: VisualizeOptions) {
    super(yAxis, options);
    this.expression = new Expression(stripEquationPrefix(yAxis));
  }

  clone(): Visualize {
    return new VisualizeEquation(this.yAxis, {
      chartType: this.selectedChartType,
    });
  }

  replace({chartType, yAxis}: {chartType?: ChartType; yAxis?: string}): Visualize {
    return new VisualizeEquation(yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
    });
  }
}

export function getVisualizesFromLocation(
  location: Location,
  key: string
): Visualize[] | null {
  const rawVisualizes = decodeList(location.query?.[key]);

  const visualizes: Visualize[] = [];

  for (const rawVisualize of rawVisualizes) {
    let value: any;
    try {
      value = JSON.parse(rawVisualize);
    } catch (error) {
      continue;
    }
    for (const visualize of parseVisualize(value)) {
      visualizes.push(visualize);
    }
  }

  return visualizes.length ? visualizes : null;
}

export function parseVisualize(value: any): Visualize[] {
  if (isBaseVisualize(value)) {
    return Visualize.fromJSON(value);
  }
  return [];
}

export function isVisualize(value: any): value is Visualize {
  return defined(value) && typeof value === 'object' && typeof value.yAxis === 'string';
}

export function isVisualizeFunction(
  visualize: Visualize
): visualize is VisualizeFunction {
  return visualize.kind === 'function';
}

export interface BaseVisualize {
  yAxes: readonly string[];
  chartType?: ChartType;
}

function isBaseVisualize(value: any): value is BaseVisualize {
  const hasYAxes =
    defined(value) &&
    typeof value === 'object' &&
    Array.isArray(value.yAxes) &&
    value.yAxes.every((yAxis: any) => typeof yAxis === 'string');

  if (hasYAxes) {
    // check for valid chart type
    if (defined(value.chartType)) {
      return Object.values(ChartType).includes(value.chartType);
    }

    // unselected chart type
    return true;
  }

  return false;
}
