import Color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import BarSeries from 'sentry/components/charts/series/barSeries';

import type {Plottable, TimeSeries} from '../../common/types';
import {markDelayedData} from '../markDelayedData';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

interface PlotOptions {
  color?: string;
  dataCompletenessDelay?: number;
  stack?: string;
}

export class Bars implements Plottable {
  timeSeries: TimeSeries;
  options: PlotOptions;

  constructor(timeSeries: TimeSeries, options: PlotOptions = {}) {
    this.timeSeries = timeSeries;
    this.options = options;
  }

  toSeries(): Array<BarSeriesOption | LineSeriesOption> {
    const {timeSeries, options} = this;

    const markedSeries = markDelayedData(timeSeries, options.dataCompletenessDelay ?? 0);

    return [
      BarSeries({
        name: markedSeries.field,
        color: markedSeries.color,
        stack: options.stack ?? GLOBAL_STACK_NAME,
        animation: false,
        itemStyle: {
          color: params => {
            const datum = markedSeries.data[params.dataIndex]!;

            return datum.delayed
              ? Color(options.color).lighten(0.5).string()
              : options.color!;
          },
          opacity: 1.0,
        },
        data: markedSeries.data.map(timeSeriesItemToEChartsDataPoint),
      }),
    ];
  }
}

const GLOBAL_STACK_NAME = 'time-series-visualization-widget-stack';
