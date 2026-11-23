// eslint-disable-next-line no-restricted-imports
import color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import {createBarSeries} from 'sentry/components/charts/series/barSeries';
import {
  INCOMPLETE_BAR_OPACITY,
  LOW_CONFIDENCE_OPACITY,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';

import {
  ContinuousTimeSeries,
  DEFAULT_SEGMENT_BY,
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

            if (segmentBy.includes('completeness') && datum.incomplete) {
              return colorObject.alpha(INCOMPLETE_BAR_OPACITY).string();
            }

            if (segmentBy.includes('confidence') && datum.confidence === 'low') {
              return colorObject.alpha(LOW_CONFIDENCE_OPACITY).string();
            }

            return colorValue;
          },
          opacity: 1,
        },
        data: scaledTimeSeries.values.map(datum => this.toDataPoint(datum, segmentBy)),
      }),
    ];
  }
}
