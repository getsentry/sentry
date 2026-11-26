import isEqual from 'lodash/isEqual';

import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {
  webVitalMetric,
  webVitalScoreMetric,
} from 'sentry/views/explore/metrics/virtualMetrics';
import {
  ORDER,
  type ProjectScore,
  type WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

import {traceMetricField} from './prebuiltConfigs/utils/traceMetricField';

export function webVitalMetricName(vital: WebVitals): string {
  return webVitalMetric(vital).name;
}

function webVitalMetricField(aggregation: 'count' | 'p75', vital: WebVitals): string {
  const metric = webVitalMetric(vital);
  return traceMetricField(aggregation, metric.name, metric.type, metric.unit);
}

export function webVitalP75Field(vital: WebVitals): string {
  return webVitalMetricField('p75', vital);
}

/**
 * Each web vital metric carries its score ratio (0 to 1) as a numeric
 * attribute, so scores come from the vital's own metric.
 */
function webVitalScoreMetricField(
  aggregation: 'avg' | 'count',
  vital: WebVitals
): string {
  const {source, attribute} = webVitalScoreMetric(vital);
  return traceMetricField(aggregation, source.name, source.type, source.unit, attribute);
}

export function webVitalScoreField(vital: WebVitals): string {
  return webVitalScoreMetricField('avg', vital);
}

export function webVitalScoreCountField(vital: WebVitals): string {
  return webVitalScoreMetricField('count', vital);
}

export function webVitalCountField(vital: WebVitals): string {
  return webVitalMetricField('count', vital);
}

export const WEB_VITAL_SCORE_FIELDS = ORDER.map(webVitalScoreField);
export const WEB_VITAL_SCORE_COUNT_FIELDS = ORDER.map(webVitalScoreCountField);

export const PERFORMANCE_SCORE_FIELD = 'performance_score()';
export const OPPORTUNITY_SCORE_FIELD = 'opportunity_score()';

export function isWebVitalScoreFormula(field: string): boolean {
  return field === PERFORMANCE_SCORE_FIELD || field === OPPORTUNITY_SCORE_FIELD;
}

export function isWebVitalScoreBreakdownChart(widgetQuery: WidgetQuery): boolean {
  return isEqual(new Set(widgetQuery.aggregates), new Set(WEB_VITAL_SCORE_FIELDS));
}

export function getWebVitalScoresFromTraceMetricsRow(
  row: Record<string, unknown>
): ProjectScore {
  const vitalsWithData = ORDER.filter(
    vital => Number(row[webVitalScoreCountField(vital)] ?? 0) > 0
  );
  const weights = getWeights(vitalsWithData);

  const ratios = Object.fromEntries(
    vitalsWithData.map(vital => [vital, Number(row[webVitalScoreField(vital)] ?? 0)])
  ) as Partial<Record<WebVitals, number>>;

  const score = (vital: WebVitals) =>
    ratios[vital] === undefined ? undefined : Math.round(ratios[vital] * 100);

  const totalScore = vitalsWithData.reduce(
    (total, vital) => total + (ratios[vital] ?? 0) * weights[vital],
    0
  );

  return {
    lcpScore: score('lcp'),
    fcpScore: score('fcp'),
    clsScore: score('cls'),
    ttfbScore: score('ttfb'),
    inpScore: score('inp'),
    totalScore: vitalsWithData.length > 0 ? Math.round(totalScore) : undefined,
  };
}
