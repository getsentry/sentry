import type {SeriesOption} from 'echarts';

import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
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
  unit: DataUnit;
  /**
   * If the chart has multiple Y axes (e.g., plotting durations and rates on the same chart), whether this value should be plotted on the left or right axis.
   */
  yAxisPosition: 'left' | 'right';
};

/**
 * `ContinuousTimeSeries` is a plottable that represents a continuous data time series. This is used for tasks like plotting a changing duration over time, for example. This is distinct from plotting items like sample series, threshold lines, etc. This ABC is inherited by specific plottable time series like `Line`, `Area`, and `Bars` to enforce the interface and share functionality.
 */
export abstract class ContinuousTimeSeries<
  TConfig extends ContinuousTimeSeriesConfig = ContinuousTimeSeriesConfig,
> {
  // Ideally both the `timeSeries` and `config` would be protected properties.
  timeSeries: Readonly<TimeSeries>;
  #timestamps: readonly string[];
  config?: Readonly<TConfig>;

  constructor(timeSeries: TimeSeries, config?: TConfig) {
    this.timeSeries = timeSeries;
    this.#timestamps = timeSeries.data.map(datum => datum.timestamp).toSorted();
    this.config = config;
  }

  get isEmpty(): boolean {
    return this.timeSeries.data.every(datum => datum.value === null);
  }

  get needsColor(): boolean {
    return !this.config?.color;
  }

  get dataType(): AggregationOutputType {
    // TODO: Remove the `as` cast. `TimeSeries` meta should use `AggregationOutputType` instead of `string`
    return this.timeSeries.meta.type as AggregationOutputType;
  }

  get dataUnit(): DataUnit {
    return this.timeSeries.meta.unit;
  }

  get start(): string | null {
    return this.#timestamps.at(0) ?? null;
  }

  get end(): string | null {
    return this.#timestamps.at(-1) ?? null;
  }

  /**
   * Shallow clones `timeSeries` and constrains `timeSeries` data to be between
   * boundary datetime (if provided).
   */
  constrainTimeSeries(boundaryStart: Date | null, boundaryEnd: Date | null) {
    return {
      ...this.timeSeries,
      data: this.timeSeries.data.filter(dataItem => {
        const ts = new Date(dataItem.timestamp);
        return (
          (!boundaryStart || ts >= boundaryStart) && (!boundaryEnd || ts <= boundaryEnd)
        );
      }),
    };
  }

  scaleToUnit(destinationUnit: DataUnit): TimeSeries {
    return scaleTimeSeriesData(this.timeSeries, destinationUnit);
  }

  abstract toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): SeriesOption[];
}
