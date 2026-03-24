import isEqual from 'lodash/isEqual';

import type {WidgetQuery} from 'sentry/views/dashboards/types';

const SCORE_AGGREGATES_SET = new Set([
  'performance_score(measurements.score.lcp)',
  'performance_score(measurements.score.fcp)',
  'performance_score(measurements.score.cls)',
  'performance_score(measurements.score.inp)',
  'performance_score(measurements.score.ttfb)',
]);

const EQUATION_SCORE_AGGREGATES_SET = new Set([
  'equation|performance_score(measurements.score.lcp)',
  'equation|performance_score(measurements.score.fcp)',
  'equation|performance_score(measurements.score.cls)',
  'equation|performance_score(measurements.score.inp)',
  'equation|performance_score(measurements.score.ttfb)',
]);

// This is not a great check, but we need to know if a widget is a performance score breakdown chart
// because it requires special handling in the widget card chart component.
export function isPerformanceScoreBreakdownChart(widgetQuery: WidgetQuery) {
  const aggregates = widgetQuery.aggregates;
  const aggregatesSet = new Set(aggregates);
  return (
    isEqual(aggregatesSet, SCORE_AGGREGATES_SET) ||
    isEqual(aggregatesSet, EQUATION_SCORE_AGGREGATES_SET)
  );
}
