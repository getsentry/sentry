import type {Theme} from '@emotion/react';

import Grid from 'sentry/components/charts/components/grid';
import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData, {
  type EventBreakpointChartData,
} from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import type {EventsStatsSeries} from 'sentry/types/organization';
import {transformStatsResponse} from 'sentry/utils/profiling/hooks/utils';
import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

import {DEFAULT_FONT_FAMILY, makeSlackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

export type FunctionRegressionPercentileData = {
  data: EventsStatsSeries<'p95()'>;
};

type FunctionRegressionChartData = {
  evidenceData: NormalizedTrendsTransaction;
  rawResponse: unknown;
};

export function makePerformanceCharts(theme: Theme): Array<RenderDescriptor<ChartType>> {
  const performanceCharts: Array<RenderDescriptor<ChartType>> = [];
  const slackChartDefaults = makeSlackChartDefaults(theme);

  const performanceChartDefaults = {
    ...slackChartDefaults,
    grid: Grid({left: 10, right: 5, bottom: 5}),
  };

  function modifyOptionsForSlack(options: Omit<LineChartProps, 'series'>) {
    options.legend = options.legend || {};
    options.legend.icon = 'none';
    options.legend.left = '25';
    options.legend.top = '20';
    options.grid = slackChartDefaults.grid;

    options.yAxis = options.yAxis || {};
    options.yAxis.axisLabel = options.yAxis.axisLabel || {};
    options.yAxis.axisLabel.fontSize = 11;
    options.yAxis.axisLabel.fontFamily = DEFAULT_FONT_FAMILY;

    options.xAxis = options.xAxis || {};
    options.xAxis.axisLabel = options.xAxis.axisLabel || {};
    options.xAxis.axisLabel.fontSize = 11;
    options.xAxis.axisLabel.fontFamily = DEFAULT_FONT_FAMILY;

    return {
      ...options,
      grid: performanceChartDefaults.grid,
      visualMap: options.options?.visualMap,
      backgroundColor: theme.tokens.background.primary,
    };
  }

  performanceCharts.push({
    key: ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
    getOption: (data: EventBreakpointChartData) => {
      const {chartOptions, series} = getBreakpointChartOptionsFromData(
        data,
        ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
        theme
      );
      const transformedSeries = transformToLineSeries({series});
      const modifiedOptions = modifyOptionsForSlack(chartOptions);

      return {
        ...modifiedOptions,
        series: transformedSeries,
      };
    },
    ...slackChartSize,
  });

  performanceCharts.push({
    key: ChartType.SLACK_PERFORMANCE_FUNCTION_REGRESSION,
    getOption: (data: FunctionRegressionChartData) => {
      const transformed = transformStatsResponse(
        'profileFunctions',
        ['p95()'],
        data.rawResponse
      );

      const percentileData = {
        data: transformed,
      };

      const param = {
        percentileData: percentileData as FunctionRegressionPercentileData,
        evidenceData: data.evidenceData,
      };

      const {chartOptions, series} = getBreakpointChartOptionsFromData(
        param,
        ChartType.SLACK_PERFORMANCE_FUNCTION_REGRESSION,
        theme
      );
      const transformedSeries = transformToLineSeries({series});
      const modifiedOptions = modifyOptionsForSlack(chartOptions);

      return {
        ...modifiedOptions,
        series: transformedSeries,
      };
    },
    ...slackChartSize,
  });

  return performanceCharts;
}
