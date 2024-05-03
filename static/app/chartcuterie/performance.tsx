import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData, {
  type EventBreakpointChartData,
} from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import {transformStatsResponse} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import {lightTheme as theme} from 'sentry/utils/theme';

import {slackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

export const performanceCharts: RenderDescriptor<ChartType>[] = [];

type PerformanceChartData = Omit<EventBreakpointChartData, 'chartType'>;

function modifyOptionsForSlack(options: Omit<LineChartProps, 'series'>) {
  options.legend = options.legend || {};
  options.legend.icon = 'none';
  options.legend.left = '25';
  options.legend.top = '20';

  return {
    ...options,
    grid: slackChartDefaults.grid,
    visualMap: options.options?.visualMap,
  };
}

performanceCharts.push({
  key: ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
  getOption: (data: PerformanceChartData) => {
    const param = {
      ...data,
      chartType: ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
    };

    const {chartOptions, series} = getBreakpointChartOptionsFromData(param, theme);
    const transformedSeries = transformToLineSeries({series});

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
  getOption: (data: PerformanceChartData) => {
    const param = {
      ...transformStatsResponse('profileFunctions', ['p95()'], data),
      chartType: ChartType.SLACK_PERFORMANCE_FUNCTION_REGRESSION,
    };

    const {chartOptions, series} = getBreakpointChartOptionsFromData(param, theme);
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
