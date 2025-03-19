import type {SeriesOption} from 'echarts';

import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';

import {isAPlottableTimeSeriesValueType} from '../../common/typePredicates';
import type {TimeSeries, TimeSeriesValueUnit} from '../../common/types';
import {formatSeriesName} from '../formatters/formatSeriesName';
import {FALLBACK_TYPE} from '../settings';

import type {PlottableTimeSeriesValueType} from './plottable';

export type ContinuousTimeSeriesConfig = {
  /**
   * Optional alias. If not provided, the series name from the legend will be computed from the `TimeSeries`.
   */
  alias?: string;
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
  unit: TimeSeriesValueUnit;
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

  get label(): string {
    return this.config?.alias ?? formatSeriesName(this.timeSeries.field);
  }

  get isEmpty(): boolean {
    return this.timeSeries.data.every(datum => datum.value === null);
  }

  get needsColor(): boolean {
    return !this.config?.color;
  }

  get dataType(): PlottableTimeSeriesValueType {
    return isAPlottableTimeSeriesValueType(this.timeSeries.meta.type)
      ? this.timeSeries.meta.type
      : FALLBACK_TYPE;
  }

  get dataUnit(): TimeSeriesValueUnit {
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

  scaleToUnit(destinationUnit: TimeSeriesValueUnit): TimeSeries {
    return scaleTimeSeriesData(this.timeSeries, destinationUnit);
  }

  abstract toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): SeriesOption[];
}
