import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/utils/useChartInterval';

/**
 * Wrapper around `useChartInterval` that uses the `USE_SECOND_BIGGEST`
 * strategy for dashboards. This keeps the dashboard detail page, widget
 * builder preview, and filters bar in sync.
 */
export function useDashboardChartInterval() {
  return useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SECOND_BIGGEST,
  });
}
