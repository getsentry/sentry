import type {LineSeriesOption} from 'echarts';

import LineSeries from 'sentry/components/charts/series/lineSeries';

import type {PlottableData} from '../../common/types';
import {splitSeriesIntoCompleteAndIncomplete} from '../splitSeriesIntoCompleteAndIncomplete';
import {timeSeriesItemToEChartsDataPoint} from '../timeSeriesItemToEChartsDataPoint';

import {
  type AggregateTimePlottingOptions,
  AggregateTimeSeries,
} from './aggregateTimeSeries';

interface AreaConfig {
  /**
   * Optional color. If not provided, a backfill from a common palette will be provided to `toSeries`
   */
  color?: string;
  /**
   * Data delay, in seconds. Data older than N seconds will be visually deemphasized.
   */
  delay?: number;
}

/**
 * See documentation for `PlottableData` for an explanation.
 */
export class Area extends AggregateTimeSeries<AreaConfig> implements PlottableData {
  toSeries(plottingOptions: AggregateTimePlottingOptions): LineSeriesOption[] {
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
