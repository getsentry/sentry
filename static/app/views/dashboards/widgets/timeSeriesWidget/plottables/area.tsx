import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {segmentTimeSeriesByDisplayStyle} from 'sentry/utils/timeSeries/segmentTimeSeriesByDisplayStyle';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

export class Area extends ContinuousTimeSeries implements Plottable {
  toSeries(plottingOptions: ContinuousTimeSeriesPlottingOptions): LineSeriesOption[] {
    const {config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;

    const plottableSeries: LineSeriesOption[] = [];

    const commonOptions = {
      name: this.name,
      color,
      animation: false,
      yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
    };

    // ECharts groups stacks by name, even when series use different Y axes.
    const stackPrefix = plottingOptions.yAxisPosition;

    const segments = segmentTimeSeriesByDisplayStyle(this.timeSeries, {
      segmentBy: this.segmentBy,
    });

    segments.forEach(([timeSeries, style], index) => {
      const data = scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
        timeSeriesItemToEChartsDataPoint
      );

      if (style === 'incomplete') {
        plottableSeries.push(
          createLineSeries({
            ...commonOptions,
            stack: `incomplete-${stackPrefix}-${index}`,
            data,
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

      if (style === 'lowConfidence') {
        plottableSeries.push(
          createLineSeries({
            ...commonOptions,
            stack: `lowConfidence-${stackPrefix}-${index}`,
            data,
            lineStyle: {
              type: 'dashed',
              opacity: 0.6,
            },
            areaStyle: {
              color,
              opacity: 0.5,
            },
          })
        );
      }

      if (style === 'normal') {
        plottableSeries.push(
          createLineSeries({
            ...commonOptions,
            stack: `complete-${stackPrefix}-${index}`,
            areaStyle: {
              color,
              opacity: 1,
            },
            data,
          })
        );
      }
    });

    return plottableSeries;
  }
}
