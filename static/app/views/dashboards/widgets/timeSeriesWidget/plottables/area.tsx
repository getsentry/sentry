import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {Plottable, TimeSeries} from '../../common/types';
import {splitSeriesIntoCompleteAndIncomplete} from '../splitSeriesIntoCompleteAndIncomplete';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

interface AreaOptions {
  color?: string;
  dataCompletenessDelay?: number;
}

export class Area implements Plottable {
  timeSeries: TimeSeries;
  options: AreaOptions;

  constructor(timeSeries: TimeSeries, options: AreaOptions = {}) {
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
          stack: 'complete',
          areaStyle: {
            color: completeTimeSeries.color,
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
            color: options.color,
            opacity: 0.8,
          },
          silent: true,
        })
      );
    }

    return plottableSeries;
  }
}
