import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {scaleTimeSeriesData} from 'sentry/utils/timeSeries/scaleTimeSeriesData';
import {segmentTimeSeriesByIncompleteData} from 'sentry/utils/timeSeries/segmentTimeSeriesByIncompleteData';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {
  ContinuousTimeSeries,
  type ContinuousTimeSeriesConfig,
  type ContinuousTimeSeriesPlottingOptions,
} from './continuousTimeSeries';
import type {Plottable} from './plottable';

interface AreaConfig extends ContinuousTimeSeriesConfig {
  /**
   * Stack name. Areas are always stacked; areas with different stack names
   * are stacked separately and overlap instead of being summed together.
   */
  stack?: string;
}

export class Area extends ContinuousTimeSeries<AreaConfig> implements Plottable {
  #timeSeriesAndIsIncomplete: Array<[TimeSeries, boolean]>;

  constructor(timeSeries: TimeSeries, config?: AreaConfig) {
    super(timeSeries, config);

    this.#timeSeriesAndIsIncomplete = segmentTimeSeriesByIncompleteData(timeSeries);
  }

  onHighlight(dataIndex: number): void {
    const {config = {}} = this;
    // The incomplete series prepends the final data point from the complete
    // series. This causes off-by-one errors with `seriesDataIndex`, since the
    // complete series has one more data points than we'd expect. Account for
    // this by reconstructing the data points from the split series
    const mergedData = this.#timeSeriesAndIsIncomplete.flatMap(([timeSeries]) => {
      return timeSeries.values;
    });

    const datum = mergedData.at(dataIndex);

    if (!datum) {
      return;
    }

    config.onHighlight?.(datum);
  }

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
    const stackPrefix = config.stack
      ? `${config.stack}-${plottingOptions.yAxisPosition}`
      : plottingOptions.yAxisPosition;

    this.#timeSeriesAndIsIncomplete.forEach(([timeSeries, isIncomplete], index) => {
      if (isIncomplete) {
        plottableSeries.push(
          createLineSeries({
            ...commonOptions,
            stack: `incomplete-${stackPrefix}-${index}`,
            data: scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
              timeSeriesItemToEChartsDataPoint
            ),
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

      if (!isIncomplete) {
        plottableSeries.push(
          createLineSeries({
            ...commonOptions,
            stack: `complete-${stackPrefix}-${index}`,
            areaStyle: {
              color,
              opacity: 1,
            },
            data: scaleTimeSeriesData(timeSeries, plottingOptions.unit).values.map(
              timeSeriesItemToEChartsDataPoint
            ),
          })
        );
      }
    });

    return plottableSeries;
  }
}
