import {t} from 'sentry/locale';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {WidgetTemplate} from 'sentry/views/dashboards/widgetLibrary/types';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';

/**
 * Shared widget definitions for Web Vitals
 * Used in both the prebuilt Web Vitals dashboard and the widget library
 */

export const SCORE_BREAKDOWN_WHEEL_WIDGET: WidgetTemplate = {
  id: 'score-breakdown-wheel',
  description: t(
    'Tracks the overall performance rating of the pages in your selected project.'
  ),
  title: t('Performance Score'),
  isCustomizable: false,
  displayType: DisplayType.WHEEL,
  widgetType: WidgetType.SPANS,
  interval: '5m',
  limit: 1,
  queries: [
    {
      name: '',
      conditions: DEFAULT_QUERY_FILTER,
      fields: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.inp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.ttfb)',
        'performance_score(measurements.score.total)',
        'count_scores(measurements.score.total)',
        'count_scores(measurements.score.lcp)',
        'count_scores(measurements.score.fcp)',
        'count_scores(measurements.score.inp)',
        'count_scores(measurements.score.cls)',
        'count_scores(measurements.score.ttfb)',
      ],
      aggregates: [],
      columns: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.inp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.ttfb)',
        'performance_score(measurements.score.total)',
        'count_scores(measurements.score.total)',
        'count_scores(measurements.score.lcp)',
        'count_scores(measurements.score.fcp)',
        'count_scores(measurements.score.inp)',
        'count_scores(measurements.score.cls)',
        'count_scores(measurements.score.ttfb)',
      ],
      orderby: '',
    },
  ],
};
