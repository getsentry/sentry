import {t} from 'sentry/locale';
import {DisplayType, SlideoutId, WidgetType} from 'sentry/views/dashboards/types';
import {type PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  DASHBOARD_DESCRIPTION,
  DASHBOARD_TITLE,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/settings';
import {
  scoreBreakdownChartWidget,
  scoreBreakdownWheelWidget,
  WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS,
  webVitalP75Meter,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/traceMetrics/widgets';
import {
  ISSUE_TYPES,
  WEB_VITALS_PREBUILT_CONFIG,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/webVitals';
import {ModuleName} from 'sentry/views/insights/types';

// TODO: Move the pages table to trace metrics once the dataset has the total
// `performance_score` and `opportunity_score` formulas (#128922). Its p75 and
// count columns already map to plain aggregates over `browser.web_vital.*`.
const SPANS_PAGES_TABLE = WEB_VITALS_PREBUILT_CONFIG.widgets.find(
  widget => widget.id === 'pages-table'
)!;

/**
 * Trace metrics variant of `WEB_VITALS_PREBUILT_CONFIG`. Same layout and
 * widgets, with the score and p75 queries reading `browser.web_vital.*`
 * metrics. The pages table stays on spans.
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
    SPANS_PAGES_TABLE,
  ],
  onboarding: {type: 'module', moduleName: ModuleName.VITAL},
};
