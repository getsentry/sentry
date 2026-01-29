import type {Theme} from '@emotion/react';
// eslint-disable-next-line no-restricted-imports
import Color from 'color';
import type {BarSeriesOption} from 'echarts';

import barCategoricalSeries from 'sentry/components/charts/categorical/barCategorical';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {DataUnit} from 'sentry/utils/discover/fields';
import {formatCategoricalSeriesLabel} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/formatters/formatCategoricalSeriesLabel';
import {formatCategoricalSeriesName} from 'sentry/views/dashboards/widgets/barChartWidgetVisualization/formatters/formatCategoricalSeriesName';
import type {
  CategoricalItem,
  CategoricalSeries,
  CategoricalValueType,
} from 'sentry/views/dashboards/widgets/common/types';

export interface BarConfig {
  /**
   * A friendly name for this plottable, used in legends and tooltips.
   */
  alias?: string;
  /**
   * Override color for this series.
   */
  color?: string;
  /**
   * Called when a bar is clicked.
   */
  onClick?: (item: CategoricalItem, dataIndex: number) => void;
  /**
   * Called when a bar is downplayed (mouse leaves).
   */
  onDownplay?: (item: CategoricalItem, dataIndex: number) => void;
  /**
   * Called when a bar is highlighted (mouse enters).
   */
  onHighlight?: (item: CategoricalItem, dataIndex: number) => void;
  /**
   * Stack name. If provided, bar plottables with the same stack will be stacked visually.
   */
  stack?: string;
}

export interface BarPlottingOptions {
  /**
   * The theme object, used for styling.
   */
  theme: Theme;
  /**
   * Override color for this series.
   */
  color?: string;
  /**
   * The orientation of the bar chart.
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * The unit of the data, used for formatting.
   */
  unit?: DataUnit | null;
  /**
   * The position of the Y axis.
   */
  yAxisPosition?: 'left' | 'right';
}

/**
 * A `BarPlottable` is any object that can be converted to an ECharts `Series`
 * for categorical bar charts. This interface is similar to `Plottable` from
 * time series widgets but adapted for categorical data.
 */
export interface BarPlottable {
  /**
   * The category labels for this plottable's data.
   */
  categories: string[];
  /**
   * Type of the underlying data.
   */
  dataType: CategoricalValueType;
  /**
   * Unit of the underlying data.
   */
  dataUnit: DataUnit | null;
  /**
   * Whether this plottable has enough data to be visually represented.
   */
  isEmpty: boolean;
  /**
   * Name of the series. This is used under-the-hood in ECharts.
   */
  name: string;
  /**
   * Whether this plottable needs a color from a shared palette.
   */
  needsColor: boolean;
  /**
   * Converts the plottable to ECharts series options.
   */
  toSeries(plottingOptions: BarPlottingOptions): BarSeriesOption[];
  /**
   * Optional callback to get access to the chart `ref`.
   */
  handleChartRef?: (ref: ReactEchartsRef) => void;
  /**
   * Optional label for this plottable, if it appears in the legend and tooltips.
   */
  label?: string;
  /**
   * Called when a bar is clicked.
   */
  onClick?: (dataIndex: number) => void;
  /**
   * Called when a bar is downplayed.
   */
  onDownplay?: (dataIndex: number) => void;
  /**
   * Called when a bar is highlighted.
   */
  onHighlight?: (dataIndex: number) => void;
}

/**
 * A plottable that renders a categorical bar series.
 */
export class Bar implements BarPlottable {
  readonly categoricalSeries: CategoricalSeries;
  readonly config: BarConfig;

  constructor(categoricalSeries: CategoricalSeries, config: BarConfig = {}) {
    this.categoricalSeries = categoricalSeries;
    this.config = config;
  }

  get name(): string {
    return this.config.alias ?? formatCategoricalSeriesName(this.categoricalSeries);
  }

  get label(): string {
    return this.config.alias ?? formatCategoricalSeriesLabel(this.categoricalSeries);
  }

  get dataType(): CategoricalValueType {
    return this.categoricalSeries.meta.valueType;
  }

  get dataUnit(): DataUnit | null {
    return this.categoricalSeries.meta.valueUnit;
  }

  get isEmpty(): boolean {
    return this.categoricalSeries.values.every(item => item.value === null);
  }

  get needsColor(): boolean {
    return this.config.color === undefined;
  }

  get categories(): string[] {
    return this.categoricalSeries.values.map(item => item.category);
  }

  handleChartRef?: (ref: ReactEchartsRef) => void;

  onClick(dataIndex: number): void {
    const item = this.categoricalSeries.values[dataIndex];
    if (item && this.config.onClick) {
      this.config.onClick(item, dataIndex);
    }
  }

  onHighlight(dataIndex: number): void {
    const item = this.categoricalSeries.values[dataIndex];
    if (item && this.config.onHighlight) {
      this.config.onHighlight(item, dataIndex);
    }
  }

  onDownplay(dataIndex: number): void {
    const item = this.categoricalSeries.values[dataIndex];
    if (item && this.config.onDownplay) {
      this.config.onDownplay(item, dataIndex);
    }
  }

  toSeries(plottingOptions: BarPlottingOptions): BarSeriesOption[] {
    const color = plottingOptions.color ?? this.config.color ?? undefined;
    const colorObject = color ? Color(color) : undefined;
    const isHorizontal = plottingOptions.orientation === 'horizontal';

    return [
      barCategoricalSeries({
        name: this.name,
        stack: this.config.stack,
        yAxisIndex: plottingOptions.yAxisPosition === 'right' ? 1 : 0,
        xAxisIndex: 0,
        color,
        emphasis: {
          itemStyle: colorObject
            ? {
                color:
                  colorObject.luminosity() > 0.5
                    ? colorObject.darken(0.1).string()
                    : colorObject.lighten(0.1).string(),
              }
            : undefined,
        },
        animation: false,
        itemStyle: {
          opacity: 1.0,
        },
        data: this.categoricalSeries.values.map(item =>
          isHorizontal
            ? [item.value, item.category]
            : {name: item.category, value: item.value}
        ),
      }),
    ];
  }
}
