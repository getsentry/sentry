import type {ReactNode} from 'react';

import {
  defaultMetricQuery,
  type BaseMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

interface MockMetricQueryParamsContextProps {
  children: ReactNode;
  metricQuery?: Partial<BaseMetricQuery>;
  traceMetric?: TraceMetric;
}

export function MockMetricQueryParamsContext({
  children,
  metricQuery,
  traceMetric = {name: 'mockMetric', type: 'counter'},
}: MockMetricQueryParamsContextProps) {
  const defaultQuery = defaultMetricQuery();
  const queryParams = metricQuery?.queryParams ?? defaultQuery.queryParams;

  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsQueryParamsProvider
        traceMetric={traceMetric}
        queryParams={queryParams}
        setQueryParams={() => {}}
        setTraceMetric={() => {}}
        removeMetric={() => {}}
      >
        {children}
      </MetricsQueryParamsProvider>
    </MultiMetricsQueryParamsProvider>
  );
}
