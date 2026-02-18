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

export const MAX_VISUALIZES = 8;

interface VisualizeOptions {
  chartType?: ChartType;
  visible?: boolean;
}

function normalizeYAxes(yAxis: string | readonly string[]): readonly string[] {
  if (typeof yAxis === 'string') {
    return [yAxis];
  }
  return [...yAxis];
}

export abstract class Visualize {
  readonly yAxes: readonly string[];
  readonly chartType: ChartType;
  readonly visible: boolean;
  protected readonly selectedChartType?: ChartType;
  abstract readonly kind: 'function' | 'equation';

  constructor(yAxis: string | readonly string[], options?: VisualizeOptions) {
    this.yAxes = normalizeYAxes(yAxis);
    this.selectedChartType = options?.chartType;
    this.chartType = this.selectedChartType ?? determineDefaultChartType(this.yAxes);
    this.visible = options?.visible ?? true;
  }

  get yAxis(): string {
    return this.yAxes[0] ?? '';
  }

  abstract clone(): Visualize;
  abstract replace({
    chartType,
    visible,
    yAxis,
    yAxes,
  }: {
    chartType?: ChartType;
    visible?: boolean;
    yAxes?: readonly string[];
    yAxis?: string;
  }): Visualize;

  serialize(): BaseVisualize {
    const json: BaseVisualize = {
      yAxes: this.yAxes,
    };

    if (defined(this.selectedChartType)) {
      json.chartType = this.selectedChartType;
    }

    if (!this.visible) {
      json.visible = this.visible;
    }

    return json;
  }

  static fromJSON(json: BaseVisualize): Visualize[] {
    if (!json.yAxes.length) {
      return [];
    }

    if (json.yAxes.some(isEquation)) {
      return json.yAxes.map(yAxis => {
        if (isEquation(yAxis)) {
          return new VisualizeEquation(yAxis, {
            chartType: json.chartType,
            visible: json.visible,
          });
        }
        return new VisualizeFunction(yAxis, {
          chartType: json.chartType,
          visible: json.visible,
        });
      });
    }

    return [
      new VisualizeFunction(json.yAxes, {
        chartType: json.chartType,
        visible: json.visible,
      }),
    ];
  }
}

export class VisualizeFunction extends Visualize {
  readonly kind = 'function';
  readonly parsedFunctions: ReadonlyArray<ParsedFunction | null>;

  constructor(yAxis: string | readonly string[], options?: VisualizeOptions) {
    super(yAxis, options);
    this.parsedFunctions = this.yAxes.map(axis => parseFunction(axis));
  }

  get parsedFunction(): ParsedFunction | null {
    return this.parsedFunctions[0] ?? null;
  }

  clone(): VisualizeFunction {
    return new VisualizeFunction(this.yAxes, {
      chartType: this.selectedChartType,
      visible: this.visible,
    });
  }

  replace({
    chartType,
    visible,
    yAxis,
    yAxes,
  }: {
    chartType?: ChartType;
    visible?: boolean;
    yAxes?: readonly string[];
    yAxis?: string;
  }): VisualizeFunction {
    return new VisualizeFunction(yAxes ?? yAxis ?? this.yAxes, {
      chartType: chartType ?? this.selectedChartType,
      visible: visible ?? this.visible,
    });
  }
}

export class VisualizeEquation extends Visualize {
  readonly kind = 'equation';
  readonly expression: Expression;

  constructor(yAxis: string, options?: VisualizeOptions) {
    super(yAxis, options);
    this.expression = new Expression(stripEquationPrefix(yAxis));
  }

  clone(): Visualize {
    return new VisualizeEquation(this.yAxis, {
      chartType: this.selectedChartType,
      visible: this.visible,
    });
  }

  replace({
    chartType,
    visible,
    yAxis,
    yAxes,
  }: {
    chartType?: ChartType;
    visible?: boolean;
    yAxes?: readonly string[];
    yAxis?: string;
  }): Visualize {
    return new VisualizeEquation(yAxes?.[0] ?? yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
      visible: visible ?? this.visible,
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

export function isVisualizeEquation(
  visualize: Visualize
): visualize is VisualizeEquation {
  return visualize.kind === 'equation';
}

export interface BaseVisualize {
  yAxes: readonly string[];
  chartType?: ChartType;
  visible?: boolean;
}

export function isBaseVisualize(value: any): value is BaseVisualize {
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
