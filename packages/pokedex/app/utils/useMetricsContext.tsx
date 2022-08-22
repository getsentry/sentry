import {useContext} from 'react';

import {MetricsContext} from 'sentry/utils/metrics/metricsContext';

export function useMetricsContext() {
  const metricsContext = useContext(MetricsContext);

  if (!metricsContext) {
    throw new Error('useMetricsContext was called outside of MetricsProvider');
  }

  return metricsContext;
}
