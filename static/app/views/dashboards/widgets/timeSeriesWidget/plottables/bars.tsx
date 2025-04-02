import Color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import BarSeries from 'sentry/components/charts/series/barSeries';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';

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
  constrain(boundaryStart: Date | null, boundaryEnd: Date | null) {
    return new Bars(this.constrainTimeSeries(boundaryStart, boundaryEnd), this.config);
  }
  toSeries(
    plottingOptions: ContinuousTimeSeriesPlottingOptions
  ): Array<BarSeriesOption | LineSeriesOption> {
    const {config = {}} = this;

    const color = plottingOptions.color ?? config.color ?? undefined;
    const colorObject = Color(color);
    const scaledTimeSeries = this.scaleToUnit(plottingOptions.unit);

    const markedSeries = markDelayedData(scaledTimeSeries, config.delay ?? 0);

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
            const datum = markedSeries.data[params.dataIndex]!;

            return datum.delayed ? colorObject.lighten(0.5).string() : color;
          },
          opacity: 1.0,
        },
        data: markedSeries.data.map(timeSeriesItemToEChartsDataPoint),
      }),
    ];
  }
}
