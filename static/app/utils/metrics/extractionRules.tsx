import type {MetricAggregation, MetricType} from 'sentry/types/metrics';

export const aggregationToMetricType: Record<MetricAggregation, MetricType> = {
  count: 'c',
  count_unique: 's',
  min: 'g',
  max: 'g',
  sum: 'g',
  avg: 'g',
  p50: 'd',
  p75: 'd',
  p95: 'd',
  p99: 'd',
};
