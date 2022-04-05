import {useContext} from 'react';

import {MetricsContext} from 'sentry/utils/metrics/metricsContext';

export function useMetricTags() {
  const metricsContext = useContext(MetricsContext);

  if (!metricsContext) {
    throw new Error('useMetricTags called but MetricsContext is not set.');
  }

  return {
    metricTags: metricsContext.tags,
  };
}
