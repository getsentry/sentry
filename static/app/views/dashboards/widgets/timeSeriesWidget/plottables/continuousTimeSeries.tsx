import type {SeriesOption} from 'echarts';

import {defined} from 'sentry/utils/defined';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import type {TimeSeriesSegmentField} from 'sentry/utils/timeSeries/segmentTimeSeriesByDisplayStyle';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {isAPlottableTimeSeriesValueType} from 'sentry/views/dashboards/widgets/common/typePredicates';
import type {
  TimeSeries,
  TimeSeriesItem,
  TimeSeriesValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {formatTimeSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesName';
import {formatTimeSeriesTransformations} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesTransformations';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';

import type {PlottableConfidence, PlottableTimeSeriesValueType} from './plottable';

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
   * Optional name override. If not provided, the name will be computed from the `TimeSeries` yAxis and groupBy.
   * This is used for ECharts series identification (e.g. legend/tooltip lookup). Tooltips display the `timeSeries.label`
   * (alias or computed from `formatTimeSeriesLabel`), not this name.
   */
  name?: string;
};

export type ContinuousTimeSeriesDataPoint = {
  value: ReturnType<typeof timeSeriesItemToEChartsDataPoint>;
  completeness?: 'complete' | 'incomplete';
  confidence?: TimeSeriesItem['confidence'];
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
  /**
   * Which item properties get their own visual treatment (e.g., incomplete or low-confidence buckets). Defaults to `['completeness']`
   */
  segmentBy?: readonly TimeSeriesSegmentField[];
};

/**
 * `ContinuousTimeSeries` is a plottable that represents a continuous data time series. This is used for tasks like plotting a changing duration over time, for example. This is distinct from plotting items like sample series, threshold lines, etc. This ABC is inherited by specific plottable time series like `Line`, `Area`, and `Bars` to enforce the interface and share functionality.
 */
export abstract class ContinuousTimeSeries<
  TConfig extends ContinuousTimeSeriesConfig = ContinuousTimeSeriesConfig,
> {
  // Ideally both the `timeSeries` and `config` would be protected properties.
  timeSeries: Readonly<TimeSeries>;
  #timestamps: readonly number[];
  config?: Readonly<TConfig>;

  constructor(timeSeries: TimeSeries, config?: TConfig) {
    this.timeSeries = timeSeries;
    this.#timestamps = timeSeries.values.map(datum => datum.timestamp).toSorted();
    this.config = config;
  }

  /**
   * Continuous time series names need to be unique to disambiguate them from other series. We use both the `yAxis` and the `groupBy` to create the name. This makes it possible to pass in two different time series with the same `yAxis` as long as they have different `groupBy` information.
   * For cases where we have multiple time series with the same `yAxis` and no `groupBy` (for example dashboards with multiple filters), we can manually set the name.
   */
  get name(): string {
    return this.config?.name ?? formatTimeSeriesName(this.timeSeries);
  }

  get label(): string {
    return this.config?.alias ?? formatTimeSeriesLabel(this.timeSeries);
  }

  get labelSuffix(): string {
    return formatTimeSeriesTransformations(this.timeSeries.requestedTransformations);
  }

  get isEmpty(): boolean {
    return this.timeSeries.values.every(datum => datum.value === null);
  }

  get confidence(): PlottableConfidence {
    const values = this.timeSeries.values.filter(datum => datum.value !== null);
    const lowCount = values.filter(isLowConfidenceDataPoint).length;

    if (lowCount > 0) {
      return lowCount === values.length ? 'low' : 'mixed';
    }

    return values.some(isExtrapolated) ? 'high' : 'full';
  }

  get needsColor(): boolean {
    return !this.config?.color;
  }

  get dataType(): PlottableTimeSeriesValueType {
    return isAPlottableTimeSeriesValueType(this.timeSeries.meta.valueType)
      ? this.timeSeries.meta.valueType
      : FALLBACK_TYPE;
  }

  get dataUnit(): TimeSeriesValueUnit {
    return this.timeSeries.meta.valueUnit;
  }

  get start(): number | null {
    return this.#timestamps.at(0) ?? null;
  }

  get end(): number | null {
    return this.#timestamps.at(-1) ?? null;
  }

  /**
   * Shallow clones `timeSeries` and constrains `timeSeries` data to be between
   * boundary datetime (if provided).
   */
  constrainTimeSeries(boundaryStart: Date | null, boundaryEnd: Date | null) {
    return {
      ...this.timeSeries,
      data: this.timeSeries.values.filter(dataItem => {
        const ts = new Date(dataItem.timestamp);
        return (
          (!boundaryStart || ts >= boundaryStart) && (!boundaryEnd || ts <= boundaryEnd)
        );
      }),
    };
  }

  /**
   * Converts an item to an ECharts data point. Fields the plottable segments by ride along on the point, so the tooltip can read them for whichever point is hovered
   */
  protected toDataPoint(
    item: TimeSeriesItem,
    segmentBy: readonly TimeSeriesSegmentField[]
  ): ContinuousTimeSeriesDataPoint {
    return {
      value: timeSeriesItemToEChartsDataPoint(item),
      confidence: segmentBy.includes('confidence') ? item.confidence : undefined,
      completeness: segmentBy.includes('completeness')
        ? getCompleteness(item)
        : undefined,
    };
  }

  scaleToUnit(destinationUnit: TimeSeriesValueUnit): TimeSeries {
    return scaleTimeSeriesData(this.timeSeries, destinationUnit);
  }

  abstract toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): SeriesOption[];
}

export const DEFAULT_SEGMENT_BY: readonly TimeSeriesSegmentField[] = ['completeness'];

export function isLowConfidenceDataPoint(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'confidence' in data &&
    data.confidence === 'low'
  );
}

function getCompleteness(
  item: TimeSeriesItem
): ContinuousTimeSeriesDataPoint['completeness'] {
  if (item.incomplete === undefined) {
    return undefined;
  }

  return item.incomplete ? 'incomplete' : 'complete';
}

function isExtrapolated(datum: TimeSeriesItem): boolean {
  return defined(datum.sampleRate) && datum.sampleRate < 1;
}
