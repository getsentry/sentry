import type {
  MetricAggregation,
  MetricsExtractionCondition,
  MetricsExtractionRule,
  MetricType,
  MRI,
} from 'sentry/types/metrics';

export const aggregationToMetricType: Record<MetricAggregation, MetricType> = {
  count: 'c',
  count_unique: 's',
  min: 'g',
  max: 'g',
  sum: 'g',
  avg: 'g',
  p50: 'd',
  p75: 'd',
  p90: 'd',
  p95: 'd',
  p99: 'd',
};

export function findExtractionRuleCondition(
  mri: MRI,
  extractionRules: MetricsExtractionRule[]
): MetricsExtractionCondition | undefined {
  for (const rule of extractionRules) {
    for (const condition of rule.conditions) {
      if (condition.mris.includes(mri)) {
        return condition;
      }
    }
  }
  return undefined;
}
