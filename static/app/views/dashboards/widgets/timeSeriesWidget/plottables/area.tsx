import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';
import {splitSeriesIntoCompleteAndIncomplete} from 'sentry/utils/timeSeries/splitSeriesIntoCompleteAndIncomplete';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

export class Area extends ContinuousTimeSeries implements Plottable {
  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): LineSeriesOption[] {
    const {timeSeries, config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;
    const scaledSeries = this.scaleToUnit(plottingOptions.unit);

    const [completeTimeSeries, incompleteTimeSeries] =
      splitSeriesIntoCompleteAndIncomplete(scaledSeries, config.delay ?? 0);

    const plottableSeries: LineSeriesOption[] = [];

    const commonOptions = {
      name: timeSeries.field,
      color,
      animation: false,
    };

    if (completeTimeSeries) {
      plottableSeries.push(
        LineSeries({
          ...commonOptions,
          stack: 'complete',
          areaStyle: {
            color,
            opacity: 1.0,
          },
          data: completeTimeSeries.data.map(timeSeriesItemToEChartsDataPoint),
        })
      );
    }

    if (incompleteTimeSeries) {
      plottableSeries.push(
        LineSeries({
          ...commonOptions,
          stack: 'incomplete',
          data: incompleteTimeSeries.data.map(timeSeriesItemToEChartsDataPoint),
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
