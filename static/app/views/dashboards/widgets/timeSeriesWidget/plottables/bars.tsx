import Color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import BarSeries from 'sentry/components/charts/series/barSeries';

import type {PlottableData} from '../../common/types';
import {markDelayedData} from '../markDelayedData';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

import {
  type AggregateTimePlottingOptions,
  AggregateTimeSeries,
} from './aggregateTimeSeries';

interface BarsConfig {
  /**
   * Optional color. If not provided, a backfill from a common palette will be provided to `toSeries`
   */
  color?: string;
  /**
   * Data delay, in seconds. Data older than N seconds will be visually deemphasized.
   */
  delay?: number;
  /**
   * Stack name. If provided, bar plottables with the same stack will be stacked visually.
   */
  stack?: string;
}

/**
 * See documentation for `PlottableData` for an explanation.
 */
export class Bars extends AggregateTimeSeries<BarsConfig> implements PlottableData {
  toSeries(
    plottingOptions: AggregateTimePlottingOptions
  ): Array<BarSeriesOption | LineSeriesOption> {
    const {timeSeries, config = {}} = this;

    const {color, unit} = plottingOptions;

    const scaledTimeSeries = this.scaleToUnit(unit);

    const markedSeries = markDelayedData(scaledTimeSeries, config.delay ?? 0);

    return [
      BarSeries({
        name: timeSeries.field,
        color: timeSeries.color,
        stack: config.stack ?? GLOBAL_STACK_NAME,
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

const GLOBAL_STACK_NAME = 'time-series-visualization-widget-stack';
