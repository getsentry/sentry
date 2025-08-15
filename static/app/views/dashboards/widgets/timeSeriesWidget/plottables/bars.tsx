import * as Sentry from '@sentry/react';
import Color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import BarSeries from 'sentry/components/charts/series/barSeries';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesConfig,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

const {error} = Sentry.logger;

interface BarsConfig extends ContinuousTimeSeriesConfig {
  /**
   * Stack name. If provided, bar plottables with the same stack will be stacked visually.
   */
  stack?: string;
}

export class Bars extends ContinuousTimeSeries<BarsConfig> implements Plottable {
  onHighlight(dataIndex: number): void {
    const {config = {}} = this;
    const datum = this.timeSeries.values.at(dataIndex);

    if (!datum) {
      error('`Bars` plottable `onHighlight` out-of-range error', {
        seriesDataIndex: dataIndex,
      });
      return;
    }

    config.onHighlight?.(datum);
  }

  toSeries(
    plottingOptions: ContinuousTimeSeriesPlottingOptions
  ): Array<BarSeriesOption | LineSeriesOption> {
    const {config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;
    const colorObject = Color(color);
    const scaledTimeSeries = this.scaleToUnit(plottingOptions.unit);

    return [
      BarSeries({
        name: this.name,
        stack: config.stack,
        yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
        color,
        emphasis: {
          itemStyle: {
            color:
              colorObject.luminosity() > 0.5
                ? colorObject.darken(0.1).string()
                : colorObject.lighten(0.1).string(),
          },
        },
        animation: false,
        itemStyle: {
          color: params => {
            const datum = scaledTimeSeries.values[params.dataIndex]!;

            return datum.incomplete ? colorObject.alpha(0.5).string() : color;
          },
          opacity: 1.0,
        },
        data: scaledTimeSeries.values.map(timeSeriesItemToEChartsDataPoint),
      }),
    ];
  }
}
