import Color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import BarSeries from 'sentry/components/charts/series/barSeries';

import {markDelayedData} from '../markDelayedData';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesConfig,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

interface BarsConfig extends ContinuousTimeSeriesConfig {
  /**
   * Stack name. If provided, bar plottables with the same stack will be stacked visually.
   */
  stack?: string;
}

export class Bars extends ContinuousTimeSeries<BarsConfig> implements Plottable {
  toSeries(
    plottingOptions: ContinuousTimeSeriesPlottingOptions
  ): Array<BarSeriesOption | LineSeriesOption> {
    const {timeSeries, config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;
    const scaledTimeSeries = this.scaleToUnit(plottingOptions.unit);

    const markedSeries = markDelayedData(scaledTimeSeries, config.delay ?? 0);

    return [
      BarSeries({
        name: timeSeries.field,
        stack: config.stack,
        animation: false,
        itemStyle: {
          color: params => {
            const datum = markedSeries.data[params.dataIndex]!;

            return datum.delayed ? Color(color).lighten(0.5).string() : color!;
          },
          opacity: 1.0,
        },
        data: markedSeries.data.map(timeSeriesItemToEChartsDataPoint),
      }),
    ];
  }
}
