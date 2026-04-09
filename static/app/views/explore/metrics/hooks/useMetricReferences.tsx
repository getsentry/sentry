import {useMemo} from 'react';

import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

export function useMetricReferences() {
  const metricQueries = useMultiMetricsQueryParams();
  return useMemo(() => {
    return new Set(
      metricQueries
        .map((metricQuery, queryIndex) => ({metricQuery, queryIndex}))
        .filter(({metricQuery}) =>
          metricQuery.queryParams.visualizes.some(isVisualizeFunction)
        )
        .map(({queryIndex}) => getVisualizeLabel(queryIndex))
    );
  }, [metricQueries]);
}
