import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {segmentSequentialBy} from 'sentry/utils/array/segmentSequentialBy';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';
import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesConfig,
  type ContinuousTimeSeriesPlottingOptions,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/continuousTimeSeries';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

/**
 * A line that draws values a transformation produced (filled or smoothed)
 * dashed, and observed values solid. It does not reuse the incomplete-bucket
 * styling of `Line`: that marks ingestion completeness, which is a separate
 * property of the data from how a value was derived.
 */
export class TransformedLine extends ContinuousTimeSeries implements Plottable {
  #derivedTimestamps: ReadonlySet<number>;

  constructor(
    timeSeries: TimeSeries,
    derivedTimestamps: ReadonlySet<number>,
    config?: ContinuousTimeSeriesConfig
  ) {
    super(timeSeries, config);
    this.#derivedTimestamps = derivedTimestamps;
  }

  #isDerived = (item: TimeSeriesItem): boolean =>
    this.#derivedTimestamps.has(item.timestamp);

  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): LineSeriesOption[] {
    const values = scaleTimeSeriesData(this.timeSeries, plottingOptions.unit).values;
    const segments = segmentSequentialBy(values, this.#isDerived);

    const commonOptions: LineSeriesOption = {
      name: this.name,
      color: plottingOptions.color ?? this.config?.color,
      animation: false,
      yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
    };

    return segments.map((segment, index) => {
      if (!segment.predicateValue) {
        return createLineSeries({
          ...commonOptions,
          data: segment.data.map(timeSeriesItemToEChartsDataPoint),
        });
      }

      // A derived run borrows the observed point on either side, so the dashed
      // line joins the solid one instead of floating beside it. The borrowed
      // points keep their observed values, and the tooltip lists one entry per
      // series name, so they are not shown twice.
      const data = [
        ...(segments[index - 1]?.data.slice(-1) ?? []),
        ...segment.data,
        ...(segments[index + 1]?.data.slice(0, 1) ?? []),
      ];

      return createLineSeries({
        ...commonOptions,
        lineStyle: {type: 'dashed'},
        // A derived value with no non-null neighbour draws no line, so mark it
        // with a symbol rather than let it disappear.
        showSymbol: true,
        data: data.map((item, itemIndex) => ({
          value: timeSeriesItemToEChartsDataPoint(item),
          symbol:
            this.#isDerived(item) &&
            item.value !== null &&
            (data[itemIndex - 1]?.value ?? null) === null &&
            (data[itemIndex + 1]?.value ?? null) === null
              ? 'circle'
              : 'none',
        })),
      });
    });
  }
}
