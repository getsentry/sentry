import type {SeriesOption} from 'echarts';

import type {
  AggregationOutputType,
  DurationUnit,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';

import type {TimeSeries} from '../../common/types';

export type ContinuousTimeSeriesConfig = {
  /**
   * Optional color. If not provided, a backfill from a common palette will be provided to `toSeries`
   */
  color?: string;
  /**
   * Data delay, in seconds. Data older than N seconds will be visually deemphasized.
   */
  delay?: number;
};

export type ContinuousTimeSeriesPlottingOptions = {
  /**
   * Final plottable color. If no color is specified in configuration, a fallback must be provided while attempting to plot
   */
  color: string;
  /**
   * Final plottable unit. This might be different from the original unit of the data, because we scale all time series to a single common unit.
   */
  unit: DurationUnit | SizeUnit | RateUnit | null;
};

/**
 * `ContinuousTimeSeries` is a plottable that represents a continuous data time series. This is used for tasks like plotting a changing duration over time, for example. This is distinct from plotting items like sample series, threshold lines, etc. This ABC is inherited by specific plottable time series like `Line`, `Area`, and `Bars` to enforce the interface and share functionality.
 */
export abstract class ContinuousTimeSeries<
  TConfig extends ContinuousTimeSeriesConfig = ContinuousTimeSeriesConfig,
> {
  // Ideally both the `timeSeries` and `config` would be protected properties.
  timeSeries: Readonly<TimeSeries>;
  config?: Readonly<TConfig>;

  constructor(timeSeries: TimeSeries, config?: TConfig) {
    this.timeSeries = timeSeries;
    this.config = config;
  }

  get isEmpty(): boolean {
    return this.timeSeries.data.every(datum => datum.value === null);
  }

  get needsColor(): boolean {
    return Boolean(this.config?.color);
  }

  get dataType(): AggregationOutputType {
    // TODO: Simplify this. `TimeSeries` types should already have this type
    return this.timeSeries.meta.fields[this.timeSeries.field]! as AggregationOutputType;
  }

  get dataUnit(): DurationUnit | SizeUnit | RateUnit | null {
    // TODO: Simplify this. `TimeSeries` units should already have this type
    return this.timeSeries.meta.units[this.timeSeries.field] as
      | DurationUnit
      | SizeUnit
      | RateUnit
      | null;
  }

  scaleToUnit(destinationUnit: DurationUnit | SizeUnit | RateUnit | null): TimeSeries {
    return scaleTimeSeriesData(this.timeSeries, destinationUnit);
  }

  abstract toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): SeriesOption[];
}
