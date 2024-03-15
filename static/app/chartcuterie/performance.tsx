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

    return {
      ...chartOptions,
      backgroundColor: theme.background,
      series: series,
      grid: slackChartDefaults.grid,
    };
  },
  ...slackChartSize,
});
