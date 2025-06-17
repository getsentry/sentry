import * as Sentry from '@sentry/react';
import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';
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

const {error} = Sentry.logger;

export class Area extends ContinuousTimeSeries implements Plottable {
  #timeSeriesAndIsIncomplete: Array<[TimeSeries, boolean]>;

  constructor(timeSeries: TimeSeries, config?: ContinuousTimeSeriesConfig) {
    super(timeSeries, config);

    this.#timeSeriesAndIsIncomplete = segmentTimeSeriesByIncompleteData(timeSeries);
  }

  onHighlight(dataIndex: number): void {
    const {config = {}} = this;
    // The incomplete series prepends the final data point from the complete
    // series. This causes off-by-one errors with `seriesDataIndex`, since the
    // complete series has one more data points than we'd expect. Account for
    // this by reconstructing the data points from the split series
    const mergedData = this.#timeSeriesAndIsIncomplete.flatMap(([timeSeries]) => {
      return timeSeries.values;
    });

    const datum = mergedData.at(dataIndex);

    if (!datum) {
      error('`Area` plottable `onHighlight` out-of-range error', {
        seriesDataIndex: dataIndex,
      });
      return;
    }

    config.onHighlight?.(datum);
  }

  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): LineSeriesOption[] {
    const {config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;

    const plottableSeries: LineSeriesOption[] = [];

    const commonOptions = {
      name: this.name,
      color,
      animation: false,
      yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
    };

    this.#timeSeriesAndIsIncomplete.forEach(([timeSeries, isIncomplete], index) => {
      if (isIncomplete === true) {
        plottableSeries.push(
          LineSeries({
            ...commonOptions,
            stack: `incomplete-${index}`,
            data: scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
              timeSeriesItemToEChartsDataPoint
            ),
            lineStyle: {
              type: 'dotted',
            },
            areaStyle: {
              color,
              opacity: 0.8,
            },
            silent: true,
          })
        );
      }

      if (isIncomplete === false) {
        plottableSeries.push(
          LineSeries({
            ...commonOptions,
            stack: `complete-${index}`,
            areaStyle: {
              color,
              opacity: 1.0,
            },
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
