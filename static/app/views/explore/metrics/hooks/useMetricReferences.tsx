import {useMemo} from 'react';

import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {getFunctionLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

export function useMetricReferences() {
  const metricQueries = useMultiMetricsQueryParams();

  return useMemo(() => {
    return new Set(
      metricQueries
        .filter(metricQuery =>
          metricQuery.queryParams.visualizes.some(isVisualizeFunction)
        )
        .map((metricQuery, index) => getFunctionLabel(metricQuery.labelIndex ?? index))
    );
  }, [metricQueries]);
}
