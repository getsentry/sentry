import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {Plottable, TimeSeries} from '../../common/types';
import {splitSeriesIntoCompleteAndIncomplete} from '../splitSeriesIntoCompleteAndIncomplete';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

interface LineOptions {
  color?: string;
  dataCompletenessDelay?: number;
}

export class Line implements Plottable {
  timeSeries: TimeSeries;
  options: LineOptions;

  constructor(timeSeries: TimeSeries, options: LineOptions = {}) {
    this.timeSeries = timeSeries;
    this.options = options;
  }

  toSeries(): LineSeriesOption[] {
    const {timeSeries, options} = this;

    const [completeTimeSeries, incompleteTimeSeries] =
      splitSeriesIntoCompleteAndIncomplete(
        timeSeries,
        options.dataCompletenessDelay ?? 0
      );

    const plottableSeries: LineSeriesOption[] = [];

    const commonOptions = {
      name: timeSeries.field,
      color: options.color,
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
