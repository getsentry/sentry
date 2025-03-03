import type {SeriesOption} from 'echarts';

import type {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';

import type {PlottableData, TimeSeries} from '../../common/types';
import {scaleTimeSeriesData} from '../scaleTimeSeriesData';

type BasicDataPlottableConfig = {
  color?: string;
};

export type AggregateTimePlottingOptions = {
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
 * `AggregateTimeSeries` is a plottable that represents a continuous data time series. This is used for tasks like plotting a changing duration over time, for example. This is distinct from plotting items like sample series, threshold lines, etc. This ABC is inherited by specific plottable time series like `Line`, `Area`, and `Bars` to enforce the interface and share functionality.
 */
export abstract class AggregateTimeSeries<TConfig extends BasicDataPlottableConfig>
  implements PlottableData
{
  // Ideally both the `timeSeries` and `config` would be protected properties.
  timeSeries: Readonly<TimeSeries>;
  config?: Readonly<TConfig>;

  constructor(timeSeries: TimeSeries, config?: TConfig) {
    this.timeSeries = timeSeries;
    this.config = config;
  }

  scaleToUnit(destinationUnit: DurationUnit | SizeUnit | RateUnit | null): TimeSeries {
    return scaleTimeSeriesData(this.timeSeries, destinationUnit);
  }

  abstract toSeries(plottingOptions: AggregateTimePlottingOptions): SeriesOption[];
}
