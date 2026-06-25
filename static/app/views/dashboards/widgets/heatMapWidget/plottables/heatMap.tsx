import type {SeriesOption} from 'echarts';

import type {Theme} from 'sentry/utils/theme';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {isAPlottableTimeSeriesValueType} from 'sentry/views/dashboards/widgets/common/typePredicates';
import type {
  HeatMapSeries,
  HeatMapValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';
import {createHeatMapColorScale} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/heatMapColorScale';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';

import type {HeatMapPlottable, PlottableTimeSeriesValueType} from './heatMapPlottable';

type HeatMapPlottingOptions = {
  theme: Theme;
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
    const {theme} = plottingOptions;

    // Color is driven by each cell's *rank* among populated cells (histogram
    // equalization) rather than its raw magnitude — see `heatMapColorScale` for
    // why. Build the scale once from the whole series.
    const colorScale = createHeatMapColorScale(
      heatMapSeries.values.map(item => item.zAxis)
    );

    return [
      {
        name: 'heatmap', // Only one heat map is allowed per visualization, so this name doesn't have to be unique
        type: 'heatmap',
        // Each datum is `[x, y, colorPosition, rawCount]`. `colorPosition` (dim
        // 2) drives the color via `visualMap`; `rawCount` (dim 3) is carried
        // through untouched so the tooltip can show the true value. `encode`
        // tells ECharts which dim is the value so the extra dim is just payload.
        dimensions: ['x', 'y', 'colorPosition', 'rawCount'],
        encode: {x: 0, y: 1, value: 2, tooltip: [3]},
        data: heatMapSeries.values.map(item => {
          if (item.zAxis === null) {
            // Empty bucket: nothing to color or report.
            return [
              item.xAxis,
              item.yAxis,
              ECHARTS_MISSING_DATA_VALUE,
              ECHARTS_MISSING_DATA_VALUE,
            ];
          }
          return [
            item.xAxis,
            item.yAxis,
            colorScale.toColorPosition(item.zAxis),
            item.zAxis,
          ];
        }),
        emphasis: {
          itemStyle: {
            borderColor: theme.tokens.border.onVibrant.dark,
            borderWidth: parseInt(theme.border.xl.replace('px', ''), 10),
          },
        },
      },
    ];
  }
}
