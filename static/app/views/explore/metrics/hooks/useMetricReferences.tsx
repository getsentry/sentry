import {useMemo} from 'react';

import {parseFunction} from 'sentry/utils/discover/fields';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

function resolveMetricReference(metricConfig: ReadableQueryParams): string {
  if (metricConfig.query) {
    // convert the aggregate to an "if" format
    const visualize = metricConfig.visualizes[0]!;
    const parsed = parseFunction(visualize.yAxis);
    if (parsed) {
      return `${parsed.name}_if(\`${metricConfig.query}\`,${parsed.arguments.join(',')})`;
    }
  }
  return metricConfig.visualizes[0]?.yAxis!;
}

export function useMetricReferences() {
  const metricQueries = useMultiMetricsQueryParams();

  return useMemo(() => {
    return Object.fromEntries(
      metricQueries
        .filter(metricQuery =>
          metricQuery.queryParams.visualizes.some(isVisualizeFunction)
        )
        .map((metricQuery, index) => [
          metricQuery.label ?? getVisualizeLabel(index, false),
          resolveMetricReference(metricQuery.queryParams),
        ])
    );
  }, [metricQueries]);
}
