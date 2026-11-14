import {t} from 'sentry/locale';
import {DisplayType, SlideoutId, WidgetType} from 'sentry/views/dashboards/types';
import {type PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DETAILS_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/settings';
import {ISSUE_TYPES} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/webVitals';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {ModuleName} from 'sentry/views/insights/types';

import {
  INTERACTIONS_FIELD,
  PAGELOADS_FIELD,
  scoreBreakdownChartWidget,
  scoreBreakdownWheelWidget,
  WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS,
  webVitalP75Meter,
  webVitalSamplesTable,
} from './widgets';

/**
 * Trace metrics variant of `WEB_VITALS_DETAILS_PREBUILT_CONFIG`
 */
export const WEB_VITALS_DETAILS_TRACE_METRICS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  projects: [],
  title: DETAILS_DASHBOARD_TITLE,
  filters: {
    globalFilter: WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS,
  },
  widgets: [
    scoreBreakdownChartWidget(
      t('Score Breakdown'),
      t(
        'Each Web Vital score contributes a different amount to the total score. Refer to the Performance Score wheel for total contribution.'
      ),
      {y: 0, w: 5, h: 2, x: 0, minH: 2}
    ),
    {
      ...scoreBreakdownWheelWidget({y: 0, w: 1, h: 2, x: 5, minH: 2}),
      description: t('The overall performance rating of this page.'),
    },
    webVitalP75Meter({
      vital: 'lcp',
      id: 'lcp-p75-meter',
      title: t('P75 Largest Contentful Paint'),
      description: t(
        'Time to render the largest item in the viewport. Bad LCP frustrates users because the website feels slow to load.'
      ),
      thresholds: {max_values: {max1: 1200, max2: 2400}, unit: null},
      slideOutId: SlideoutId.LCP_SUMMARY,
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
      slideOutId: SlideoutId.INP_SUMMARY,
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
      slideOutId: SlideoutId.CLS_SUMMARY,
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
      slideOutId: SlideoutId.TTFB_SUMMARY,
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
      layout: {y: 2, w: 3, h: 2, x: 2, minH: 2},
    },
    {
      id: 'pageloads-chart',
      title: t('Pageloads'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: [PAGELOADS_FIELD],
          aggregates: [PAGELOADS_FIELD],
          columns: [],
          orderby: '',
        },
      ],
      layout: {y: 2, w: 1, h: 2, x: 5, minH: 2},
    },
    {
      id: 'interactions-chart',
      title: t('Interactions'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: [INTERACTIONS_FIELD],
          aggregates: [INTERACTIONS_FIELD],
          columns: [],
          orderby: '',
        },
      ],
      layout: {y: 4, w: 1, h: 2, x: 5, minH: 2},
    },
    webVitalSamplesTable({
      vital: 'lcp',
      id: 'lcp-samples-table',
      title: t('LCP Samples'),
      extraFields: [TraceMetricKnownFieldKey.BROWSER_WEB_VITAL_LCP_ELEMENT],
      tableWidths: [-1, -1, 200, -1, -1, -1, -1],
      layout: {y: 6, w: 5, h: 2, x: 0, minH: 2},
    }),
    webVitalSamplesTable({
      vital: 'inp',
      id: 'inp-samples-table',
      title: t('INP Samples'),
      layout: {y: 8, w: 5, h: 2, x: 0, minH: 2},
    }),
    webVitalSamplesTable({
      vital: 'cls',
      id: 'cls-samples-table',
      title: t('CLS Samples'),
      layout: {y: 10, w: 5, h: 2, x: 0, minH: 2},
    }),
  ],
  onboarding: {type: 'module', moduleName: ModuleName.VITAL},
};
