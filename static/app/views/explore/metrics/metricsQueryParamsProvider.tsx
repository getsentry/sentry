import type {ReactNode} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {
  MetricsFrozenContextProvider,
  type MetricsFrozenContextProviderProps,
} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

const [
  _MetricsAnalyticsPageSourceProvider,
  _useMetricsAnalyticsPageSource,
  MetricsAnalyticsPageSourceContext,
] = createDefinedContext<string>({
  name: 'MetricsAnalyticsPageSourceContext',
});

export const useMetricsAnalyticsPageSource = _useMetricsAnalyticsPageSource;

interface MetricsQueryParamsProviderProps {
  children: ReactNode;
  freeze?: MetricsFrozenContextProviderProps;
}

export function MetricsQueryParamsProvider({
  children,
  freeze,
}: MetricsQueryParamsProviderProps) {
  return (
    <MetricsAnalyticsPageSourceContext value="metrics">
      <MetricsFrozenContextProvider {...freeze}>
        <MultiMetricsQueryParamsProvider>{children}</MultiMetricsQueryParamsProvider>
      </MetricsFrozenContextProvider>
    </MetricsAnalyticsPageSourceContext>
  );
}
