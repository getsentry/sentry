import type {Theme} from '@emotion/react';

import {XAxis} from 'sentry/components/charts/components/xAxis';
import {LineSeries} from 'sentry/components/charts/series/lineSeries';
import {timeSeriesItemToEChartsDataPoint} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';

import {DEFAULT_FONT_FAMILY, makeSlackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

type ExploreChartData = {
  timeSeries: TimeSeries[];
};

export const makeExploreCharts = (theme: Theme): Array<RenderDescriptor<ChartType>> => {
  const exploreXAxis = XAxis({
    theme,
    splitNumber: 3,
    isGroupedByDate: true,
    axisLabel: {fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY},
  });

  const slackChartDefaults = makeSlackChartDefaults(theme);
  const exploreCharts: Array<RenderDescriptor<ChartType>> = [];

  exploreCharts.push({
    key: ChartType.SLACK_EXPLORE_LINE,
    getOption: (data: ExploreChartData) => {
      const {timeSeries} = data;

      if (timeSeries.length === 0) {
        return {
          ...slackChartDefaults,
          xAxis: exploreXAxis,
          useUTC: true,
          series: [],
        };
      }

      const hasGroups = timeSeries.some(ts => ts.groupBy && ts.groupBy.length > 0);

      if (!hasGroups) {
        const ts = timeSeries[0]!;
        const color = theme.chart.getColorPalette(0);
        const lineSeries = LineSeries({
          name: ts.yAxis,
          data: ts.values.map(timeSeriesItemToEChartsDataPoint),
          lineStyle: {color: color?.[0], opacity: 1},
          itemStyle: {color: color?.[0]},
        });

        return {
          ...slackChartDefaults,
          xAxis: exploreXAxis,
          useUTC: true,
          color,
          series: [lineSeries],
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

      const series = sorted.map((ts, i) => {
        return LineSeries({
          name: formatTimeSeriesLabel(ts),
          data: ts.values.map(timeSeriesItemToEChartsDataPoint),
          lineStyle: {color: color?.[i], opacity: 1},
          itemStyle: {color: color?.[i]},
        });
      });

      return {
        ...slackChartDefaults,
        xAxis: exploreXAxis,
        useUTC: true,
        color,
        series,
      };
    },
    ...slackChartSize,
  });

  return exploreCharts;
};
