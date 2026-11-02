import isEqual from 'lodash/isEqual';

import {DurationUnit, FractionUnit, type DataUnit} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {traceMetricField} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/traceMetricField';
import {
  ORDER,
  type ProjectScore,
  type WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

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

function webVitalScoreMetricField(
  aggregation: 'avg' | 'count',
  vital: WebVitals
): string {
  return traceMetricField(
    aggregation,
    `browser.web_vital.${vital}.score`,
    'distribution',
    FractionUnit.RATIO
  );
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
