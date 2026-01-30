import type {Theme} from '@emotion/react';
import type {SeriesOption} from 'echarts';

import type {DataUnit} from 'sentry/utils/discover/fields';
import {formatCategoricalSeriesLabel} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/formatters/formatCategoricalSeriesLabel';
import {formatCategoricalSeriesName} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/formatters/formatCategoricalSeriesName';
import type {
  CategoricalItem,
  CategoricalSeries,
  CategoricalValueType,
} from 'sentry/views/dashboards/widgets/common/types';

export type CategoricalDataSeriesConfig = {
  /**
   * Optional alias. If not provided, the series name from the legend will be
   * computed from the `CategoricalSeries`.
   */
  alias?: string;
  /**
   * Optional color. If not provided, a backfill from a common palette will be
   * provided to `toSeries`.
   */
  color?: string;
  /**
   * Callback for ECharts' `onHighlight`. Called with the data point that
   * corresponds to the highlighted point in the chart and its index.
   */
  onHighlight?: (datum: Readonly<CategoricalItem>, dataIndex: number) => void;
};

export type CategoricalPlottingOptions = {
  /**
   * The theme object, used for styling (e.g., emphasis colors).
   */
  theme: Theme;
  /**
   * Final plottable color. If no color is specified in configuration, a
   * fallback must be provided while attempting to plot.
   */
  color?: string;
  /**
   * The unit of the data, used for formatting. This might be different from
   * the original unit if normalization is applied.
   */
  unit?: DataUnit | null;
};

/**
 * `CategoricalDataSeries` is a plottable that represents a categorical data
 * series. This is used for tasks like plotting values across discrete
 * categories (e.g., transaction names, error types). This ABC is inherited
 * by specific plottable types like `Bars` to enforce the interface and share
 * functionality.
 */
export abstract class CategoricalDataSeries<
  TConfig extends CategoricalDataSeriesConfig = CategoricalDataSeriesConfig,
> {
  /**
   * The underlying categorical data series.
   */
  readonly categoricalSeries: Readonly<CategoricalSeries>;
  /**
   * Optional configuration for this plottable.
   */
  readonly config?: Readonly<TConfig>;

  constructor(categoricalSeries: CategoricalSeries, config?: TConfig) {
    this.categoricalSeries = categoricalSeries;
    this.config = config;
  }

  /**
   * Categorical series names are derived from the `valueAxis` and `groupBy`
   * to create unique identifiers for ECharts.
   */
  get name(): string {
    return formatCategoricalSeriesName(this.categoricalSeries);
  }

  /**
   * Human-readable label for legends and tooltips. Uses alias if provided,
   * otherwise computed from the series.
   */
  get label(): string {
    return this.config?.alias ?? formatCategoricalSeriesLabel(this.categoricalSeries);
  }

  /**
   * True if all values in the series are null.
   */
  get isEmpty(): boolean {
    return this.categoricalSeries.values.every(item => item.value === null);
  }

  /**
   * True if no color was provided in config, meaning one should be assigned
   * from the shared palette.
   */
  get needsColor(): boolean {
    return this.config?.color === undefined;
  }

  /**
   * The type of values in this series (e.g., "duration", "number").
   */
  get dataType(): CategoricalValueType {
    return this.categoricalSeries.meta.valueType;
  }

  /**
   * The unit of values in this series (e.g., "millisecond"), or null if unitless.
   */
  get dataUnit(): DataUnit | null {
    return this.categoricalSeries.meta.valueUnit;
  }

  /**
   * The category labels for all data points in this series.
   */
  get categories(): string[] {
    return this.categoricalSeries.values.map(item => item.category);
  }

  /**
   * Convert this plottable to ECharts series options.
   * @param plottingOptions Options for rendering, including color and unit.
   */
  abstract toSeries(plottingOptions: CategoricalPlottingOptions): SeriesOption[];
}
