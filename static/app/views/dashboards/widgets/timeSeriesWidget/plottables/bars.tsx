// eslint-disable-next-line no-restricted-imports
import color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import {createBarSeries} from 'sentry/components/charts/series/barSeries';

import {
  ContinuousTimeSeries,
  DEFAULT_SEGMENT_BY,
  type ContinuousTimeSeriesConfig,
  type ContinuousTimeSeriesPlottingOptions,
  isLowConfidenceDataPoint,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

interface BarsConfig extends ContinuousTimeSeriesConfig {
  /**
   * Stack name. If provided, bar plottables with the same stack will be stacked visually.
   */
  stack?: string;
}

export class Bars extends ContinuousTimeSeries<BarsConfig> implements Plottable {
  toSeries(
    plottingOptions: ContinuousTimeSeriesPlottingOptions
  ): Array<BarSeriesOption | LineSeriesOption> {
    const {config = {}} = this;
    const segmentBy = plottingOptions.segmentBy ?? DEFAULT_SEGMENT_BY;

    const colorValue = plottingOptions.color ?? config.color ?? undefined;
    const colorObject = color(colorValue);
    const scaledTimeSeries = this.scaleToUnit(plottingOptions.unit);

    return [
      createBarSeries({
        name: this.name,
        stack: config.stack,
        yAxisIndex: plottingOptions.yAxisPosition === 'left' ? 0 : 1,
        color: colorValue,
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

            return segmentBy.includes('completeness') && datum.incomplete
              ? colorObject.alpha(0.5).string()
              : colorValue;
          },
          opacity: 1,
        },
        data: scaledTimeSeries.values.map(datum => {
          const dataPoint = this.toDataPoint(datum, segmentBy);

          if (!isLowConfidenceDataPoint(dataPoint)) {
            return dataPoint;
          }

          return {
            ...dataPoint,
            itemStyle: {
              decal: {
                ...LOW_CONFIDENCE_DECAL,
                // The hatch has to contrast with the bar's own color, not the
                // page background, so theme tokens don't apply here
                color:
                  colorObject.luminosity() > 0.5
                    ? 'rgba(0, 0, 0, 0.35)'
                    : 'rgba(255, 255, 255, 0.45)',
              },
            },
          };
        }),
      }),
    ];
  }
}

// Diagonal hatch drawn over low-confidence bars
const LOW_CONFIDENCE_DECAL = {
  symbol: 'rect',
  symbolSize: 1,
  dashArrayX: [1, 0],
  dashArrayY: [2, 4],
  rotation: -Math.PI / 4,
};
