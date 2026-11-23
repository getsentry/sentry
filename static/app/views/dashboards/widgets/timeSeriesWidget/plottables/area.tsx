import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {segmentTimeSeriesByIncompleteData} from 'sentry/utils/timeSeries/segmentTimeSeriesByIncompleteData';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

export class Area extends ContinuousTimeSeries implements Plottable {
  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): LineSeriesOption[] {
    const {config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;

    const commonOptions = {
      name: this.name,
      color,
      animation: false,
      yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
    };

    // ECharts groups stacks by name, even when series use different Y axes.
    const stackPrefix = plottingOptions.yAxisPosition;

    return segmentTimeSeriesByIncompleteData(this.timeSeries).map(
      ([timeSeries, isIncomplete], index) => {
        const data = scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
          item => this.toDataPoint(item)
        );

        if (isIncomplete) {
          return createLineSeries({
            ...commonOptions,
            stack: `incomplete-${stackPrefix}-${index}`,
            data,
            lineStyle: {type: 'dotted'},
            areaStyle: {color, opacity: 0.8},
            silent: true,
          });
        }

        return createLineSeries({
          ...commonOptions,
          stack: `complete-${stackPrefix}-${index}`,
          areaStyle: {color, opacity: 1},
          data,
        });
      }
    );
  }
}
