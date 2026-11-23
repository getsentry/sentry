import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {segmentTimeSeriesByIncompleteData} from 'sentry/utils/timeSeries/segmentTimeSeriesByIncompleteData';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

export class Line extends ContinuousTimeSeries implements Plottable {
  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions) {
    const {config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;

    const commonOptions: LineSeriesOption = {
      name: this.name,
      color,
      animation: false,
      yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
    };

    return segmentTimeSeriesByIncompleteData(this.timeSeries).map(
      ([timeSeries, isIncomplete]) =>
        createLineSeries({
          ...commonOptions,
          ...(isIncomplete && {lineStyle: {type: 'dotted'}, silent: true}),
          data: scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(item =>
            this.toDataPoint(item)
          ),
        })
    );
  }
}
