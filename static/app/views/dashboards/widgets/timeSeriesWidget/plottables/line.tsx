import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';

import {splitSeriesIntoCompleteAndIncomplete} from '../splitSeriesIntoCompleteAndIncomplete';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

export class Line extends ContinuousTimeSeries implements Plottable {
  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions) {
    const {timeSeries, config = {}} = this;

    const {color, unit} = plottingOptions;

    const scaledSeries = this.scaleToUnit(unit);

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
          data: completeTimeSeries.data.map(timeSeriesItemToEChartsDataPoint),
        })
      );
    }

    if (incompleteTimeSeries) {
      plottableSeries.push(
        LineSeries({
          ...commonOptions,
          data: incompleteTimeSeries.data.map(timeSeriesItemToEChartsDataPoint),
          lineStyle: {
            type: 'dotted',
          },
          silent: true,
        })
      );
    }

    return plottableSeries;
  }
}
