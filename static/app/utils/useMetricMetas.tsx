import {useContext} from 'react';

import {MetricsContext} from 'sentry/utils/metrics/metricsContext';

export function useMetricMetas() {
  const metricsContext = useContext(MetricsContext);

  if (!metricsContext) {
    throw new Error('useMetricMetas called but MetricsContext is not set.');
  }

  return {
    metricMetas: metricsContext.metas,
  };
}
