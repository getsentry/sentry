import localStorage from 'sentry/utils/localStorage';

type MetricsDataSource = 'snuba' | 'mock' | undefined;

export function getMetricsDataSource(): MetricsDataSource {
  const retrieved = localStorage.getItem('metrics.datasource');

  if (retrieved && ['snuba', 'mock'].includes(retrieved)) {
    return retrieved as MetricsDataSource;
  }

  return undefined;
}
