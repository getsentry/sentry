import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {isPerformanceScoreBreakdownChart} from 'sentry/views/dashboards/widgetBuilder/utils/isPerformanceScoreBreakdownChart';

describe('isPerformanceScoreBreakdownChart', () => {
  const baseWidgetQuery: WidgetQuery = {
    aggregates: [],
    columns: [],
    conditions: '',
    name: '',
    orderby: '',
  };

  it('returns true', () => {
    const widgetQuery: WidgetQuery = {
      ...baseWidgetQuery,
      aggregates: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.inp)',
        'performance_score(measurements.score.ttfb)',
      ],
    };

    expect(isPerformanceScoreBreakdownChart(widgetQuery)).toBe(true);
  });

  it('returns false', () => {
    const widgetQuery: WidgetQuery = {
      ...baseWidgetQuery,
      aggregates: ['count()'],
    };

    expect(isPerformanceScoreBreakdownChart(widgetQuery)).toBe(false);
  });
});
