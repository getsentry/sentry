import {useContext} from 'react';

import {MetricsContext} from 'sentry/utils/metrics/metricsContext';

export function useMetricMetas() {
  const metricsContext = useContext(MetricsContext);

  if (!metricsContext) {
    throw new Error('useMetricsMeta was called outside of MetricsContextProvider');
  }

  return {
    metricMetas: metricsContext.metas,
  };
}
