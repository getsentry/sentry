import isEqual from 'lodash/isEqual';

import type {WidgetQuery} from 'sentry/views/dashboards/types';

// This is not a great check, but we need to know if a widget is a performance score breakdown chart
// because it requires special handling in the widget card chart component.
export function isPerformanceScoreBreakdownChart(widgetQuery: WidgetQuery) {
  const aggregates = widgetQuery.aggregates;
  return isEqual(aggregates, [
    'performance_score(measurements.score.lcp)',
    'performance_score(measurements.score.fcp)',
    'performance_score(measurements.score.cls)',
    'performance_score(measurements.score.inp)',
    'performance_score(measurements.score.ttfb)',
  ]);
}
