import type {SeriesOption} from 'echarts';

import type {AccuracyStats, Confidence} from 'sentry/types/organization';
import type {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';

import type {ThresholdsConfig} from '../../widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

export type Meta = {
  fields: Record<string, string | null>;
  units: Record<string, string | null>;
  isOther?: boolean;
};

type TableRow = Record<string, number | string | undefined>;
export type TableData = TableRow[];

export type TimeSeriesItem = {
  timestamp: string;
  value: number | null;
  delayed?: boolean;
};

export type TimeSeries = {
  data: TimeSeriesItem[];
  field: string;
  meta: Meta;
  color?: string;
  confidence?: Confidence;
  sampleCount?: AccuracyStats<number>;
  samplingRate?: AccuracyStats<number | null>;
};

export type ErrorProp = Error | string;

export interface StateProps {
  error?: ErrorProp;
  isLoading?: boolean;
  onRetry?: () => void;
}

export type Thresholds = ThresholdsConfig;

export type Release = {
  timestamp: string;
  version: string;
};

export type Aliases = Record<string, string>;

export type LegendSelection = {[key: string]: boolean};

/**
 * A `Plottable` is any object that can be converted to an ECharts `Series` and therefore plotted on an ECharts chart. This could be a data series, releases, samples, and other kinds of markers. `TimeSeriesWidgetVisualization` uses `Plottable` objects under the hood, to convert data coming into the component via props into ECharts series.
 */
interface Plottable {
  /**
   *
   * @param plottingOptions Plotting options depend on the specific implementation of the interface.
   */
  toSeries(plottingOptions: unknown): SeriesOption[];
}

/**
 * `PlottableData` is any plottable that represents a data time series. The points in the series are a pair of a timestamp and a numeric value. This could be a continuous time series of aggregated data, or data samples.
 */
export interface PlottableData extends Plottable {
  /**
   * @param options Plotting options. The resulting series will have the color `color`, and will be scaled to `unit` if needed.
   */
  toSeries(plottingOptions: {
    color: string;
    unit: DurationUnit | SizeUnit | RateUnit | null;
  }): SeriesOption[];
}
