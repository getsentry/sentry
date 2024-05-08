import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData, {
  type EventBreakpointChartData,
} from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import {lightTheme as theme} from 'sentry/utils/theme';

import {slackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

export const performanceCharts: RenderDescriptor<ChartType>[] = [];

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
  getOption: (data: EventBreakpointChartData) => {
    const {chartOptions, series} = getBreakpointChartOptionsFromData(data, theme);
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
