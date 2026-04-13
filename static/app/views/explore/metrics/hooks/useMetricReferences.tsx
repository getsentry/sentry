import {useMemo} from 'react';

import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

export function useMetricReferences() {
  const metricQueries = useMultiMetricsQueryParams();

  // TODO: This is only correct since all queries are listed before equations. If
  // this changes we need to update this to persist the labels of the queries so
  // references are still valid.
  return useMemo(() => {
    return new Set(
      metricQueries
        .filter(metricQuery =>
          metricQuery.queryParams.visualizes.some(isVisualizeFunction)
        )
        .map((_metricQuery, index) => getVisualizeLabel(index))
    );
  }, [metricQueries]);
}
