import * as Sentry from '@sentry/react';
import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {splitSeriesIntoCompleteAndIncomplete} from 'sentry/utils/timeSeries/splitSeriesIntoCompleteAndIncomplete';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';

import type {TimeSeries} from '../../common/types';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesConfig,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

const {error} = Sentry.logger;

export class Area extends ContinuousTimeSeries implements Plottable {
  #completeTimeSeries?: TimeSeries;
  #incompleteTimeSeries?: TimeSeries;

  constructor(timeSeries: TimeSeries, config?: ContinuousTimeSeriesConfig) {
    super(timeSeries, config);

    const [completeTimeSeries, incompleteTimeSeries] =
      splitSeriesIntoCompleteAndIncomplete(timeSeries, config?.delay ?? 0);

    this.#completeTimeSeries = completeTimeSeries;
    this.#incompleteTimeSeries = incompleteTimeSeries;
  }

  constrain(boundaryStart: Date | null, boundaryEnd: Date | null) {
    return new Area(this.constrainTimeSeries(boundaryStart, boundaryEnd), this.config);
  }

  onHighlight(dataIndex: number): void {
    const {config = {}} = this;
    // The incomplete series prepends the final data point from the complete
    // series. This causes off-by-one errors with `seriesDataIndex`, since the
    // complete series has one more data points than we'd expect. Account for
    // this by reconstructing the data points from the split series
    const mergedData = [
      ...(this.#completeTimeSeries?.data ?? []),
      ...(this.#incompleteTimeSeries?.data ?? []),
    ];

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
      name: this.label,
      color,
      animation: false,
      yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
    };

    if (this.#completeTimeSeries) {
      plottableSeries.push(
        LineSeries({
          ...commonOptions,
          stack: 'complete',
          areaStyle: {
            color,
            opacity: 1.0,
          },
          data: scaleTimeSeriesData(
            this.#completeTimeSeries,
            plottingOptions.unit
          ).data.map(timeSeriesItemToEChartsDataPoint),
        })
      );
    }

    if (this.#incompleteTimeSeries) {
      plottableSeries.push(
        LineSeries({
          ...commonOptions,
          stack: 'incomplete',
          data: scaleTimeSeriesData(
            this.#incompleteTimeSeries,
            plottingOptions.unit
          ).data.map(timeSeriesItemToEChartsDataPoint),
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

    return plottableSeries;
  }
}
