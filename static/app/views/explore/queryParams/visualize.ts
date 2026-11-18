import {parseAsJson, parseAsNativeArrayOf} from 'nuqs';
import {z} from 'zod';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {defined} from 'sentry/utils/defined';
import {
  isEquation,
  parseFunction,
  stripEquationPrefix,
  type ParsedFunction,
} from 'sentry/utils/discover/fields';
import {determineDefaultChartType} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {ChartType} from 'sentry/views/insights/common/components/chartTypes';

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
  transformations?: readonly string[];
  visible?: boolean;
}

export abstract class Visualize {
  readonly yAxis: string;
  readonly chartType: ChartType;
  readonly visible: boolean;
  readonly chartGroup?: string;
  readonly transformations: readonly string[];
  protected readonly selectedChartType?: ChartType;
  abstract readonly kind: 'function' | 'equation';

  constructor(yAxis: string, options?: VisualizeOptions) {
    this.yAxis = yAxis;
    this.selectedChartType = options?.chartType;
    this.chartGroup = options?.chartGroup;
    this.transformations = [...(options?.transformations ?? [])];
    // Several aggregates on one chart only read well as lines; stacked areas or
    // bars would add up values that don't sum. The selected chart type is kept
    // so it comes back once the visualize leaves its chart group.
    this.chartType = defined(this.chartGroup)
      ? ChartType.LINE
      : (this.selectedChartType ?? determineDefaultChartType([yAxis]));
    this.visible = options?.visible ?? true;
  }

  get hasSelectedChartType(): boolean {
    return defined(this.selectedChartType);
  }

  abstract clone(): Visualize;
  abstract replace({
    chartType,
    visible,
    yAxis,
    internalExpression,
    chartGroup,
    transformations,
  }: {
    chartGroup?: string | null;
    chartType?: ChartType;
    internalExpression?: string;
    transformations?: readonly string[];
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

    if (this.transformations.length) {
      json.transformations = [...this.transformations];
    }

    return json;
  }

  static fromJSON(json: BaseVisualize, options?: ParseVisualizeOptions): Visualize[] {
    const visualizes = json.yAxes.map(yAxis => {
      if (isEquation(yAxis)) {
        return new VisualizeEquation(yAxis, {
          chartType: json.chartType,
          visible: json.visible,
          internalExpression: json.internalExpression,
          transformations: json.transformations,
        });
      }
      return new VisualizeFunction(yAxis, {
        chartType: json.chartType,
        visible: json.visible,
        transformations: json.transformations,
      });
    });

    if (
      visualizes.length < 2 ||
      !visualizes.every(isVisualizeFunction) ||
      !options?.groupYAxes?.(json.yAxes)
    ) {
      return visualizes;
    }

    const chartGroup = createChartGroup();
    return visualizes.map(visualize => visualize.replace({chartGroup}));
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
      transformations: this.transformations,
    });
  }

  replace({
    chartType,
    visible,
    yAxis,
    chartGroup,
    transformations,
  }: {
    chartGroup?: string | null;
    chartType?: ChartType;
    transformations?: readonly string[];
    visible?: boolean;
    yAxis?: string;
  }): VisualizeFunction {
    return new VisualizeFunction(yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
      visible: visible ?? this.visible,
      // `null` removes the visualize from its chart group.
      chartGroup: chartGroup === null ? undefined : (chartGroup ?? this.chartGroup),
      transformations: transformations ?? this.transformations,
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
      transformations: this.transformations,
    });
  }

  replace({
    chartType,
    visible,
    yAxis,
    internalExpression,
    transformations,
  }: {
    // Equations are never grouped with other visualizes.
    chartGroup?: string | null;
    chartType?: ChartType;
    internalExpression?: string;
    transformations?: readonly string[];
    visible?: boolean;
    yAxis?: string;
  }): Visualize {
    return new VisualizeEquation(yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
      visible: visible ?? this.visible,
      internalExpression: internalExpression ?? this.internalExpression,
      transformations: transformations ?? this.transformations,
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

export function getVisualizes(
  baseVisualizes: readonly BaseVisualize[],
  options?: ParseVisualizeOptions
): Visualize[] | null {
  const visualizes = baseVisualizes.flatMap(json => Visualize.fromJSON(json, options));
  return visualizes.length ? visualizes : null;
}

export function parseVisualize(value: unknown): Visualize[] {
  const result = baseVisualizeSchema.safeParse(value);
  return result.success ? Visualize.fromJSON(result.data) : [];
}

export function isVisualize(value: any): value is Visualize {
  return defined(value) && typeof value === 'object' && typeof value.yAxis === 'string';
}

export function isVisualizeFunction(
  visualize: Visualize
): visualize is VisualizeFunction {
  return visualize.kind === 'function';
}

export function hasVisualizeTransformations(visualizes: readonly Visualize[]): boolean {
  return visualizes.some(visualize => visualize.transformations.length > 0);
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
  transformations?: readonly string[];
  visible?: boolean;
}

export const baseVisualizeSchema = z.object({
  yAxes: z.array(z.string()),
  chartType: z.enum(ChartType).optional().catch(undefined),
  internalExpression: z.string().optional().catch(undefined),
  transformations: z.array(z.string()).optional().catch(undefined),
  visible: z.boolean().optional().catch(undefined),
});

export const parseAsBaseVisualizeList = parseAsNativeArrayOf(
  parseAsJson(baseVisualizeSchema)
);
