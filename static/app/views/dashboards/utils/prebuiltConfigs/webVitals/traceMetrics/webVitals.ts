import {t} from 'sentry/locale';
import {DisplayType, SlideoutId, WidgetType} from 'sentry/views/dashboards/types';
import {type PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  DASHBOARD_DESCRIPTION,
  DASHBOARD_TITLE,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/settings';
import {
  PAGELOADS_FIELD,
  scoreBreakdownChartWidget,
  scoreBreakdownWheelWidget,
  WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS,
  webVitalP75Field,
  webVitalP75Meter,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/traceMetrics/widgets';
import {ISSUE_TYPES} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/webVitals';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

/**
 * Trace metrics variant of `WEB_VITALS_PREBUILT_CONFIG`. Same layout and
 * widgets, with the spans queries replaced by `browser.web_vital.*` metrics.
 */
export const WEB_VITALS_TRACE_METRICS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DASHBOARD_TITLE,
  description: DASHBOARD_DESCRIPTION,
  filters: {
    globalFilter: WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS,
  },
  widgets: [
    scoreBreakdownWheelWidget({y: 0, w: 2, h: 2, x: 0, minH: 2}),
    scoreBreakdownChartWidget(
      t('Score Breakdown'),
      t(
        'Each Web Vital score contributes a different amount to the total score. Refer to the Performance Score wheel for total contribution.'
      ),
      {y: 0, w: 4, h: 2, x: 2, minH: 2}
    ),
    webVitalP75Meter({
      vital: 'lcp',
      id: 'lcp-p75-meter',
      title: t('P75 Largest Contentful Paint'),
      description: t(
        'Time to render the largest item in the viewport. Bad LCP frustrates users because the website feels slow to load.'
      ),
      thresholds: {max_values: {max1: 1200, max2: 2400}, unit: null},
      slideOutId: SlideoutId.LCP,
      layout: {y: 2, w: 1, h: 1, x: 0, minH: 1},
    }),
    webVitalP75Meter({
      vital: 'inp',
      id: 'inp-p75-meter',
      title: t('P75 Interaction to Next Paint'),
      description: t(
        'Latency between user input and visual response. Bad INP makes users feel like the site is laggy, outdated, and unresponsive.'
      ),
      thresholds: {max_values: {max1: 200, max2: 500}, unit: null},
      slideOutId: SlideoutId.INP,
      layout: {y: 2, w: 1, h: 1, x: 1, minH: 1},
    }),
    webVitalP75Meter({
      vital: 'cls',
      id: 'cls-p75-meter',
      title: t('P75 Cumulative Layout Shift'),
      description: t(
        "Measures content 'shifting' during load. Bad CLS indicates a janky website, degrading UX and trust."
      ),
      thresholds: {max_values: {max1: 0.1, max2: 0.25}, unit: null},
      slideOutId: SlideoutId.CLS,
      layout: {y: 3, w: 1, h: 1, x: 0, minH: 1},
    }),
    webVitalP75Meter({
      vital: 'ttfb',
      id: 'ttfb-p75-meter',
      title: t('P75 Time to First Byte'),
      description: t(
        'Time until first byte is delivered to the client. Bad TTFB makes the server feel unresponsive.'
      ),
      thresholds: {max_values: {max1: 200, max2: 400}, unit: 'millisecond'},
      slideOutId: SlideoutId.TTFB,
      layout: {y: 3, w: 1, h: 1, x: 1, minH: 1},
    }),
    {
      id: 'issues-table',
      title: t('Web Vital Issues'),
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.ISSUE,
      interval: '5m',
      tableWidths: [-1, 100, -1],
      queries: [
        {
          name: '',
          conditions: `issue.type:[${ISSUE_TYPES.join(',')}]`,
          fields: ['issue', 'assignee', 'title'],
          aggregates: [],
          columns: ['issue', 'assignee', 'title'],
          orderby: 'date',
        },
      ],
      layout: {y: 2, w: 4, h: 2, x: 2, minH: 2},
    },
    {
      id: 'pages-table',
      title: t('Pages'),
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: '5m',
      tableWidths: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      queries: [
        {
          name: '',
          conditions: '',
          fields: [
            SpanFields.TRANSACTION,
            SpanFields.PROJECT,
            PAGELOADS_FIELD,
            webVitalP75Field('lcp'),
            webVitalP75Field('fcp'),
            webVitalP75Field('cls'),
            webVitalP75Field('ttfb'),
            webVitalP75Field('inp'),
            'performance_score(measurements.score.total)',
            'opportunity_score(measurements.score.total)',
          ],
          aggregates: [],
          columns: [
            SpanFields.TRANSACTION,
            SpanFields.PROJECT,
            PAGELOADS_FIELD,
            webVitalP75Field('lcp'),
            webVitalP75Field('fcp'),
            webVitalP75Field('cls'),
            webVitalP75Field('ttfb'),
            webVitalP75Field('inp'),
            'performance_score(measurements.score.total)',
            'opportunity_score(measurements.score.total)',
          ],
          orderby: '-opportunity_score(measurements.score.total)',
          fieldAliases: [
            t('Pages'),
            t('Project'),
            t('Pageloads'),
            t('LCP'),
            t('FCP'),
            t('CLS'),
            t('TTFB'),
            t('INP'),
            t('Perf Score'),
            t('Opportunity'),
          ],
          linkedDashboards: [
            {
              dashboardId: '-1',
              field: SpanFields.TRANSACTION,
              staticDashboardId: 7,
              additionalGlobalFilterDatasetTargets: [WidgetType.ISSUE],
            },
          ],
        },
      ],
      layout: {y: 4, w: 6, h: 6, x: 0, minH: 2},
    },
  ],
  onboarding: {type: 'module', moduleName: ModuleName.VITAL},
};
