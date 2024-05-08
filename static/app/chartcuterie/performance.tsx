import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData, {
  type EventBreakpointChartData,
} from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import {lightTheme as theme} from 'sentry/utils/theme';

import {slackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

export const performanceCharts: RenderDescriptor<ChartType>[] = [];

performanceCharts.push({
  key: ChartType.SLACK_PERFORMANCE_ENDPOINT_REGRESSION,
  getOption: (data: EventBreakpointChartData) => {
    const {chartOptions, series} = getBreakpointChartOptionsFromData(data, theme);
    const transformedSeries = transformToLineSeries({series});

    return {
      ...chartOptions,
      backgroundColor: theme.background,
      series: transformedSeries,
      grid: slackChartDefaults.grid,
    };
  },
  ...slackChartSize,
});
