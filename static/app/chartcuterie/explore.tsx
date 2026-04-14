import type {Theme} from '@emotion/react';

import {Grid} from 'sentry/components/charts/components/grid';
import {Legend} from 'sentry/components/charts/components/legend';
import {XAxis} from 'sentry/components/charts/components/xAxis';
import {YAxis} from 'sentry/components/charts/components/yAxis';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';
import type {ContinuousTimeSeriesPlottingOptions} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/continuousTimeSeries';
import {createPlottableFromTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';

import {DEFAULT_FONT_FAMILY} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

/**
 * Font size and spacing scaled for the larger explore chart canvas (1200x400).
 */
const EXPLORE_FONT_SIZE = 28;
const EXPLORE_CHART_SIZE = {width: 1200, height: 400};

/**
 * Builds a y-axis axisLabel formatter from the first timeseries metadata.
 */
function makeYAxisFormatter(timeSeries: TimeSeries[]) {
  const firstSeries = timeSeries[0];
  const valueType = firstSeries?.meta?.valueType ?? 'number';
  const valueUnit = firstSeries?.meta?.valueUnit;

  return (value: number) => formatYAxisValue(value, valueType, valueUnit ?? undefined);
}

type ExploreChartData = {
  timeSeries: TimeSeries[];
  type?: DisplayType;
};

export const makeExploreCharts = (theme: Theme): Array<RenderDescriptor<ChartType>> => {
  const exploreXAxis = XAxis({
    theme,
    splitNumber: 3,
    isGroupedByDate: true,
    axisLabel: {fontSize: EXPLORE_FONT_SIZE, fontFamily: DEFAULT_FONT_FAMILY},
  });

  const exploreDefaults = {
    grid: Grid({left: 10, right: 10, bottom: 10, top: 60}),
    backgroundColor: theme.tokens.background.primary,
    legend: Legend({
      theme,
      icon: 'roundRect',
      itemHeight: 16,
      itemWidth: 16,
      itemGap: 16,
      top: 6,
      left: 10,
      truncate: 40,
      textStyle: {
        fontSize: EXPLORE_FONT_SIZE,
        lineHeight: EXPLORE_FONT_SIZE * 1.4,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
      pageTextStyle: {
        fontSize: EXPLORE_FONT_SIZE,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
      pageIconSize: EXPLORE_FONT_SIZE * 0.6,
    }),
    yAxis: YAxis({
      theme,
      splitNumber: 3,
      axisLabel: {fontSize: EXPLORE_FONT_SIZE, fontFamily: DEFAULT_FONT_FAMILY},
    }),
  };

  const exploreCharts: Array<RenderDescriptor<ChartType>> = [];

  exploreCharts.push({
    key: ChartType.SLACK_EXPLORE_LINE,
    getOption: (data: ExploreChartData) => {
      const {timeSeries, type: displayType = DisplayType.LINE} = data;

      if (timeSeries.length === 0) {
        return {
          ...exploreDefaults,
          xAxis: exploreXAxis,
          useUTC: true,
          series: [],
        };
      }

      const exploreYAxis = YAxis({
        theme,
        splitNumber: 3,
        axisLabel: {
          fontSize: EXPLORE_FONT_SIZE,
          fontFamily: DEFAULT_FONT_FAMILY,
          formatter: makeYAxisFormatter(timeSeries),
        },
      });

      const hasGroups = timeSeries.some(ts => ts.groupBy && ts.groupBy.length > 0);

      if (!hasGroups) {
        const ts = timeSeries[0]!;
        const color = theme.chart.getColorPalette(0);
        const plottingOptions: ContinuousTimeSeriesPlottingOptions = {
          color: color?.[0] ?? '',
          unit: ts.meta?.valueUnit ?? null,
          yAxisPosition: 'left',
        };
        const plottable = createPlottableFromTimeSeries(displayType, ts);
        const series = plottable?.toSeries(plottingOptions) ?? [];

        return {
          ...exploreDefaults,
          yAxis: exploreYAxis,
          xAxis: exploreXAxis,
          useUTC: true,
          color,
          series,
        };
      }

      const sorted = timeSeries
        .slice()
        .sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));
      const hasOther = sorted.some(ts => ts.meta?.isOther);
      const color = theme.chart
        .getColorPalette(sorted.length - 1 - (hasOther ? 1 : 0))
        ?.slice() as string[];
      if (hasOther) {
        color.push(theme.tokens.content.secondary);
      }

      const series = sorted.flatMap((ts, i) => {
        const plottingOptions: ContinuousTimeSeriesPlottingOptions = {
          color: color?.[i] ?? '',
          unit: ts.meta?.valueUnit ?? null,
          yAxisPosition: 'left',
        };
        const plottable = createPlottableFromTimeSeries(displayType, ts, {
          name: formatTimeSeriesLabel(ts),
          color: color?.[i],
        });
        return plottable?.toSeries(plottingOptions) ?? [];
      });

      return {
        ...exploreDefaults,
        yAxis: exploreYAxis,
        xAxis: exploreXAxis,
        useUTC: true,
        color,
        series,
      };
    },
    ...EXPLORE_CHART_SIZE,
  });

  return exploreCharts;
};
