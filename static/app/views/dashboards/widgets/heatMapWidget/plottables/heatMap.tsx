import type {SeriesOption} from 'echarts';

import type {Theme} from 'sentry/utils/theme';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {isAPlottableTimeSeriesValueType} from 'sentry/views/dashboards/widgets/common/typePredicates';
import type {
  HeatMapSeries,
  HeatMapValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';

import type {HeatMapPlottable, PlottableTimeSeriesValueType} from './heatMapPlottable';

type HeatMapPlottingOptions = {
  theme: Theme;
  /**
   * The Z-axis scale type. `'log'` applies `Math.log1p` to Z values so the
   * color gradient distributes logarithmically. Useful when the Z range is
   * very wide and low values would otherwise be invisible.
   */
  scale?: 'linear' | 'log';
};

export class HeatMap implements HeatMapPlottable {
  readonly heatMapSeries: Readonly<HeatMapSeries>;
  readonly Zstart: number;
  readonly Zend: number;

  constructor(heatMapSeries: HeatMapSeries) {
    this.heatMapSeries = heatMapSeries;

    this.Zstart = heatMapSeries.meta.zAxis.start;
    this.Zend = heatMapSeries.meta.zAxis.end;
  }

  get isEmpty(): boolean {
    return this.heatMapSeries.values.every(item => item.zAxis === null);
  }

  get yAxisValueType(): PlottableTimeSeriesValueType {
    return isAPlottableTimeSeriesValueType(this.heatMapSeries.meta.yAxis.valueType)
      ? this.heatMapSeries.meta.yAxis.valueType
      : FALLBACK_TYPE;
  }

  get yAxisValueUnit(): HeatMapValueUnit {
    return this.heatMapSeries.meta.yAxis.valueUnit;
  }

  toSeries(plottingOptions: HeatMapPlottingOptions): SeriesOption[] {
    const {heatMapSeries} = this;
    const {scale = 'linear'} = plottingOptions;

    return [
      {
        name: 'heatmap', // Only one heat map is allowed per visualization, so this name doesn't have to be unique
        type: 'heatmap',
        data: heatMapSeries.values.map(item => {
          const zValue = item.zAxis ?? ECHARTS_MISSING_DATA_VALUE;
          return [
            item.xAxis,
            item.yAxis,
            scale === 'log' && typeof zValue === 'number' ? Math.log1p(zValue) : zValue,
          ];
        }),
        emphasis: {
          disabled: true,
        },
      },
    ];
  }
}
