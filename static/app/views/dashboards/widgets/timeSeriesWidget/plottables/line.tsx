import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {
  segmentTimeSeriesByDisplayStyle,
  type TimeSeriesDisplayStyle,
} from 'sentry/utils/timeSeries/segmentTimeSeriesByDisplayStyle';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';

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

    const segments = segmentTimeSeriesByDisplayStyle(this.timeSeries, {
      showLowConfidence: plottingOptions.showLowConfidence,
    });

    return segments.map(([timeSeries, style]) =>
      createLineSeries({
        ...commonOptions,
        ...STYLE_OPTIONS[style],
        data: scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
          timeSeriesItemToEChartsDataPoint
        ),
      })
    );
  }
}

const STYLE_OPTIONS: Record<TimeSeriesDisplayStyle, Partial<LineSeriesOption>> = {
  normal: {},
  lowConfidence: {lineStyle: {type: 'dashed', opacity: 0.6}},
  incomplete: {lineStyle: {type: 'dotted'}, silent: true},
};
