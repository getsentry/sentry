import type {Location} from 'history';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {defined} from 'sentry/utils/defined';
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
  /**
   * Visualizes that share a chart group are plotted on the same chart. They
   * are serialized together as a single entry with multiple `yAxes`.
   */
  chartGroup?: string;
  chartType?: ChartType;
  // The internal expression is used to store the reference format for
  // equations so we can properly update the correct references when
  // dependencies change
  internalExpression?: string;
  visible?: boolean;
}

export abstract class Visualize {
  readonly yAxis: string;
  readonly chartType: ChartType;
  readonly visible: boolean;
  readonly chartGroup?: string;
  protected readonly selectedChartType?: ChartType;
  abstract readonly kind: 'function' | 'equation';

  constructor(yAxis: string, options?: VisualizeOptions) {
    this.yAxis = yAxis;
    this.selectedChartType = options?.chartType;
    this.chartType = this.selectedChartType ?? determineDefaultChartType([yAxis]);
    this.visible = options?.visible ?? true;
    this.chartGroup = options?.chartGroup;
  }

  abstract clone(): Visualize;
  abstract replace({
    chartType,
    visible,
    yAxis,
    internalExpression,
    chartGroup,
  }: {
    chartGroup?: string | null;
    chartType?: ChartType;
    internalExpression?: string;
    visible?: boolean;
    yAxis?: string;
  }): Visualize;

  serialize(): BaseVisualize {
    const json: BaseVisualize = {
      yAxes: [this.yAxis],
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
    return json.yAxes.map(yAxis => {
      if (isEquation(yAxis)) {
        return new VisualizeEquation(yAxis, {
          chartType: json.chartType,
          visible: json.visible,
          internalExpression: json.internalExpression,
        });
      }
      return new VisualizeFunction(yAxis, {
        chartType: json.chartType,
        visible: json.visible,
      });
    });
  }
}

export interface ParseVisualizeOptions {
  /**
   * Decides whether the y axes listed together in one entry are plotted on the
   * same chart. When omitted, every y axis gets a chart of its own.
   */
  groupYAxes?: (yAxes: readonly string[]) => boolean;
}

let nextChartGroup = 0;

/**
 * Returns a new chart group id. Ids only need to be unique among the
 * visualizes of a query, they are not persisted.
 */
export function createChartGroup(): string {
  nextChartGroup += 1;
  return `chart-group-${nextChartGroup}`;
}

/**
 * Splits visualizes into the charts they are plotted on. Adjacent visualizes
 * that share a chart group are plotted together, every other visualize gets a
 * chart of its own.
 */
export function groupVisualizes<V extends Visualize>(
  visualizes: readonly V[]
): Array<{index: number; visualizes: V[]}> {
  const groups: Array<{index: number; visualizes: V[]}> = [];
  visualizes.forEach((visualize, index) => {
    const lastGroup = groups[groups.length - 1];
    if (
      defined(visualize.chartGroup) &&
      lastGroup?.visualizes[0]?.chartGroup === visualize.chartGroup
    ) {
      lastGroup.visualizes.push(visualize);
    } else {
      groups.push({index, visualizes: [visualize]});
    }
  });
  return groups;
}

/**
 * Serializes visualizes, merging the visualizes of each chart group into a
 * single entry so the group survives a round trip through the URL.
 */
export function serializeVisualizes(visualizes: readonly Visualize[]): BaseVisualize[] {
  return groupVisualizes(visualizes).map(group => {
    const [first, ...rest] = group.visualizes;
    const json = first!.serialize();
    if (rest.length) {
      json.yAxes = group.visualizes.map(visualize => visualize.yAxis);
    }
    return json;
  });
}

export class VisualizeFunction extends Visualize {
  readonly kind = 'function';
  readonly parsedFunction: ParsedFunction | null;

  constructor(yAxis: string, options?: VisualizeOptions) {
    super(yAxis, options);
    this.parsedFunction = parseFunction(yAxis);
  }

  clone(): VisualizeFunction {
    return new VisualizeFunction(this.yAxis, {
      chartType: this.selectedChartType,
      visible: this.visible,
      chartGroup: this.chartGroup,
    });
  }

  replace({
    chartType,
    visible,
    yAxis,
    chartGroup,
  }: {
    chartGroup?: string | null;
    chartType?: ChartType;
    visible?: boolean;
    yAxis?: string;
  }): VisualizeFunction {
    return new VisualizeFunction(yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
      visible: visible ?? this.visible,
      // `null` removes the visualize from its chart group.
      chartGroup: chartGroup === null ? undefined : (chartGroup ?? this.chartGroup),
    });
  }
}

export class VisualizeEquation extends Visualize {
  readonly kind = 'equation';
  readonly expression: Expression;
  readonly internalExpression?: string;

  constructor(yAxis: string, options?: VisualizeOptions) {
    super(yAxis, options);
    this.expression = new Expression(stripEquationPrefix(yAxis));
    this.internalExpression = options?.internalExpression;
  }

  clone(): Visualize {
    return new VisualizeEquation(this.yAxis, {
      chartType: this.selectedChartType,
      internalExpression: this.internalExpression,
    });
  }

  replace({
    chartType,
    visible,
    yAxis,
    internalExpression,
  }: {
    // Equations are never grouped with other visualizes.
    chartGroup?: string | null;
    chartType?: ChartType;
    internalExpression?: string;
    visible?: boolean;
    yAxis?: string;
  }): Visualize {
    return new VisualizeEquation(yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
      visible: visible ?? this.visible,
      internalExpression: internalExpression ?? this.internalExpression,
    });
  }

  override serialize(): BaseVisualize {
    const json = super.serialize();
    if (this.internalExpression) {
      json.internalExpression = this.internalExpression;
    }
    return json;
  }
}

export function getVisualizesFromLocation(
  location: Location,
  key: string,
  options?: ParseVisualizeOptions
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
    for (const visualize of parseVisualize(value, options)) {
      visualizes.push(visualize);
    }
  }

  return visualizes.length ? visualizes : null;
}

export function parseVisualize(value: any, options?: ParseVisualizeOptions): Visualize[] {
  if (!isBaseVisualize(value)) {
    return [];
  }

  const visualizes = Visualize.fromJSON(value);
  if (
    visualizes.length < 2 ||
    !visualizes.every(isVisualizeFunction) ||
    !options?.groupYAxes?.(value.yAxes)
  ) {
    return visualizes;
  }

  const chartGroup = createChartGroup();
  return visualizes.map(visualize => visualize.replace({chartGroup}));
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
  internalExpression?: string;
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
