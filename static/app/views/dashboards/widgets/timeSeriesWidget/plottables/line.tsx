import type {LineSeriesOption} from 'echarts';

import {LineSeries} from 'sentry/components/charts/series/lineSeries';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {segmentTimeSeriesByIncompleteData} from 'sentry/utils/timeSeries/segmentTimeSeriesByIncompleteData';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesConfig,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

export class Line extends ContinuousTimeSeries implements Plottable {
  #timeSeriesAndIsIncomplete: Array<[TimeSeries, boolean]>;

  constructor(timeSeries: TimeSeries, config?: ContinuousTimeSeriesConfig) {
    super(timeSeries, config);

    this.#timeSeriesAndIsIncomplete = segmentTimeSeriesByIncompleteData(timeSeries);
  }

  onHighlight(seriesDataIndex: number): void {
    const {config = {}} = this;
    // The incomplete series prepends the final data point from the complete
    // series. This causes off-by-one errors with `seriesDataIndex`, since the
    // complete series has one more data points than we'd expect. Account for
    // this by reconstructing the data points from the split series
    const mergedData = this.#timeSeriesAndIsIncomplete.flatMap(([timeSeries]) => {
      return timeSeries.values;
    });

    const datum = mergedData.at(seriesDataIndex);

    if (!datum) {
      return;
    }

    config.onHighlight?.(datum);
  }

  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions) {
    const {config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;

    const plottableSeries: LineSeriesOption[] = [];

    const commonOptions: LineSeriesOption = {
      name: this.name,
      color,
      animation: false,
      yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
    };

    this.#timeSeriesAndIsIncomplete.forEach(([timeSeries, isIncomplete]) => {
      if (isIncomplete) {
        plottableSeries.push(
          LineSeries({
            ...commonOptions,
            data: scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
              timeSeriesItemToEChartsDataPoint
            ),
            lineStyle: {
              type: 'dotted',
            },
            silent: true,
          })
        );
      }

      if (!isIncomplete) {
        plottableSeries.push(
          LineSeries({
            ...commonOptions,
            data: scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
              timeSeriesItemToEChartsDataPoint
            ),
          })
        );
      }
    });

    return plottableSeries;
  }
}
