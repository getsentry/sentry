import type {Theme} from '@emotion/react';

import {XAxis} from 'sentry/components/charts/components/xAxis';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import type {ContinuousTimeSeriesPlottingOptions} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/continuousTimeSeries';
import {createPlottableFromTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';

import {DEFAULT_FONT_FAMILY, makeSlackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

type ExploreChartData = {
  timeSeries: TimeSeries[];
  type?: DisplayType;
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
      const {timeSeries, type: displayType = DisplayType.LINE} = data;

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
        const plottingOptions: ContinuousTimeSeriesPlottingOptions = {
          color: color?.[0] ?? '',
          unit: ts.meta.valueUnit,
          yAxisPosition: 'left',
        };
        const plottable = createPlottableFromTimeSeries(displayType, ts, {
          color: color?.[0],
        });

        return {
          ...slackChartDefaults,
          xAxis: exploreXAxis,
          useUTC: true,
          color,
          series: plottable?.toSeries(plottingOptions) ?? [],
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
          unit: ts.meta.valueUnit,
          yAxisPosition: 'left',
        };
        const plottable = createPlottableFromTimeSeries(displayType, ts, {
          name: formatTimeSeriesLabel(ts),
          color: color?.[i],
        });
        return plottable?.toSeries(plottingOptions) ?? [];
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
