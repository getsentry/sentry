import {useCallback} from 'react';

import type {MetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

/**
 * Allows the widget builder to pick up on changes to a specific metric query that's selected in
 * the equations UI since we're restricting to a single query for equations.
 */
export function BuilderStateMetricsQueryParamsProvider({
  metricQuery,
  isSelected,
  onQueryParamsChange,
  children,
}: {
  children: React.ReactNode;
  isSelected: boolean;
  metricQuery: MetricQuery;
  onQueryParamsChange?: (newQueryParams: ReadableQueryParams) => void;
}) {
  // Merge widget builder state setting with setting the query params on the metric query.
  // We only track a single filter for the selected row. If the selected row is an equation,
  // and subcomponent filters are updated, those trickle down into the equation's definition.
  // The filter for the equation needs to be tracked separately in the widget builder state.
  const handleSetQueryParams = useCallback(
    (newQueryParams: ReadableQueryParams) => {
      metricQuery.setQueryParams(newQueryParams);
      if (isSelected) {
        onQueryParamsChange?.(newQueryParams);
      }
    },
    [metricQuery, isSelected, onQueryParamsChange]
  );

  return (
    <MetricsQueryParamsProvider
      queryParams={metricQuery.queryParams}
      traceMetric={metricQuery.metric}
      setTraceMetric={metricQuery.setTraceMetric}
      setQueryParams={handleSetQueryParams}
      removeMetric={metricQuery.removeMetric}
    >
      {children}
    </MetricsQueryParamsProvider>
  );
}
