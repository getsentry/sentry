import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData, {
  type EventBreakpointChartData,
} from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import type {EventsStatsSeries} from 'sentry/types';
import {transformStatsResponse} from 'sentry/utils/profiling/hooks/utils';
import {lightTheme as theme} from 'sentry/utils/theme';
import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

import {DEFAULT_FONT_FAMILY, slackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

export const performanceCharts: RenderDescriptor<ChartType>[] = [];

export type FunctionRegressionPercentileData = {
  data: EventsStatsSeries<'p95()'>;
};

function modifyOptionsForSlack(options: Omit<LineChartProps, 'series'>) {
  options.legend = options.legend || {};
  options.legend.icon = 'none';
  options.legend.left = '25';
  options.legend.top = '20';
  options.grid = slackChartDefaults.grid;

  options.yAxis = options.yAxis || {};
  options.yAxis.axisLabel = options.yAxis.axisLabel || {};
  options.yAxis.axisLabel.fontFamily = DEFAULT_FONT_FAMILY;

  options.xAxis = options.xAxis || {};
  options.xAxis.axisLabel = options.xAxis.axisLabel || {};
  options.xAxis.axisLabel.fontFamily = DEFAULT_FONT_FAMILY;

  return {
    ...options,
    grid: slackChartDefaults.grid,
    visualMap: options.options?.visualMap,
  };
}
type FunctionRegressionChartData = {
  evidenceData: NormalizedTrendsTransaction;
  rawResponse: any;
};

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

      backgroundColor: theme.background,
      series: transformedSeries,
      grid: slackChartDefaults.grid,
      visualMap: modifiedOptions.options?.visualMap,
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

      backgroundColor: theme.background,
      series: transformedSeries,
      grid: slackChartDefaults.grid,
      visualMap: modifiedOptions.options?.visualMap,
    };
  },
  ...slackChartSize,
});
