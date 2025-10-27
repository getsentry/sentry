import type {ReactNode} from 'react';

import {defaultMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

export function MockMetricQueryParamsContext({children}: {children: ReactNode}) {
  const mockQueryParams = defaultMetricQuery();
  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsQueryParamsProvider
        traceMetric={{name: 'mockMetric', type: 'counter'}}
        queryParams={mockQueryParams.queryParams}
        setQueryParams={() => {}}
        setTraceMetric={() => {}}
        removeMetric={() => {}}
      >
        {children}
      </MetricsQueryParamsProvider>
    </MultiMetricsQueryParamsProvider>
  );
}
