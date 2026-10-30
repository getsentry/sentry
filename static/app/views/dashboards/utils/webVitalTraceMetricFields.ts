import isEqual from 'lodash/isEqual';

import {DurationUnit, type DataUnit} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {traceMetricField} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/traceMetricField';
import {
  ORDER,
  type ProjectScore,
  type WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

/**
 * Relay emits two distributions for every vital on a pageload or interaction
 * span: `browser.web_vital.<vital>` holds the raw vital and
 * `browser.web_vital.<vital>.score` holds its 0-1 performance score as a
 * ratio. The trace metrics dataset has no `performance_score` or
 * `count_scores` formulas, so the web vitals widgets read the scores with
 * plain aggregates over the score metric instead.
 */
const WEB_VITAL_METRIC_UNITS: Record<WebVitals, DataUnit> = {
  lcp: DurationUnit.MILLISECOND,
  fcp: DurationUnit.MILLISECOND,
  inp: DurationUnit.MILLISECOND,
  ttfb: DurationUnit.MILLISECOND,
  cls: null,
};

function webVitalMetricField(aggregation: 'count' | 'p75', vital: WebVitals): string {
  return traceMetricField(
    aggregation,
    `browser.web_vital.${vital}`,
    'distribution',
    WEB_VITAL_METRIC_UNITS[vital]
  );
}

export function webVitalP75Field(vital: WebVitals): string {
  return webVitalMetricField('p75', vital);
}

/**
 * Average 0-1 score for a vital. Matches what
 * `performance_score(measurements.score.<vital>)` returns on spans.
 */
export function webVitalScoreField(vital: WebVitals): string {
  return traceMetricField(
    'avg',
    `browser.web_vital.${vital}.score`,
    'distribution',
    'ratio'
  );
}

/** Number of pageloads or interactions that reported the vital. */
export function webVitalCountField(vital: WebVitals): string {
  return webVitalMetricField('count', vital);
}

export const WEB_VITAL_SCORE_FIELDS = ORDER.map(webVitalScoreField);
export const WEB_VITAL_COUNT_FIELDS = ORDER.map(webVitalCountField);

/** Trace metrics counterpart of `isPerformanceScoreBreakdownChart`. */
export function isWebVitalScoreBreakdownChart(widgetQuery: WidgetQuery): boolean {
  return isEqual(new Set(widgetQuery.aggregates), new Set(WEB_VITAL_SCORE_FIELDS));
}

/**
 * Builds the performance score ring's scores from a row of score and count
 * fields. The total weights each vital's score the way the spans
 * `performance_score(measurements.score.total)` formula does: only vitals
 * with data count, and their weights are rescaled to add up to 100.
 */
export function getWebVitalScoresFromTraceMetricsRow(
  row: Record<string, unknown>
): ProjectScore {
  const vitalsWithData = ORDER.filter(
    vital => Number(row[webVitalCountField(vital)] ?? 0) > 0
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
