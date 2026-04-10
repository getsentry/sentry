import {useMemo} from 'react';

import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

export function useMetricReferences() {
  const metricQueries = useMultiMetricsQueryParams();

  return useMemo(() => {
    return new Set(
      metricQueries
        .filter(metricQuery =>
          metricQuery.queryParams.visualizes.some(isVisualizeFunction)
        )
        .map(metricQuery => metricQuery.label!)
        .filter(Boolean)
    );
  }, [metricQueries]);
}
