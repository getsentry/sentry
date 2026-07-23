import {t} from 'sentry/locale';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {traceMetricField} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/traceMetricField';

const INTERVAL = '5m';

// Emitted by the browser SDK's `bfcacheMetricsIntegration`.
const NAVIGATION = traceMetricField('sum', 'browser.bfcache.navigation', 'counter', null);
const NOT_RESTORED = traceMetricField(
  'sum',
  'browser.bfcache.not_restored',
  'counter',
  null
);
const RELOAD_P75 = 'p75(value,browser.bfcache.reload.duration,distribution,millisecond)';
const RELOAD_P95 = 'p95(value,browser.bfcache.reload.duration,distribution,millisecond)';

export const BFCACHE_METRICS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  filters: {},
  projects: [],
  title: 'BFCache Metrics',
  widgets: [
    {
      id: 'bfcache-hits-vs-misses',
      title: t('BFCache Hits vs Misses'),
      displayType: DisplayType.AREA,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser.bfcache.outcome', NAVIGATION],
          aggregates: [NAVIGATION],
          columns: ['browser.bfcache.outcome'],
          orderby: `-${NAVIGATION}`,
        },
      ],
      layout: {x: 0, y: 0, w: 3, h: 2, minH: 2},
    },
    {
      id: 'bfcache-outcome-trend',
      title: t('BFCache Outcome Trend'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser.bfcache.outcome', NAVIGATION],
          aggregates: [NAVIGATION],
          columns: ['browser.bfcache.outcome'],
          orderby: `-${NAVIGATION}`,
        },
      ],
      layout: {x: 3, y: 0, w: 3, h: 2, minH: 2},
    },
    {
      id: 'bfcache-miss-reload-duration',
      title: t('BFCache Miss Reload Duration'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['sentry.transaction', RELOAD_P75, RELOAD_P95],
          aggregates: [RELOAD_P75, RELOAD_P95],
          columns: ['sentry.transaction'],
          orderby: `-${RELOAD_P75}`,
        },
      ],
      layout: {x: 0, y: 2, w: 6, h: 2, minH: 2},
    },
    {
      id: 'bfcache-misses-by-route',
      title: t('BFCache Misses by Route'),
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: 'browser.bfcache.outcome:miss',
          fields: ['sentry.transaction', NAVIGATION],
          aggregates: [NAVIGATION],
          columns: ['sentry.transaction'],
          orderby: `-${NAVIGATION}`,
        },
      ],
      layout: {x: 0, y: 4, w: 3, h: 3, minH: 2},
    },
    {
      id: 'bfcache-not-restored-reasons',
      title: t('Top BFCache Not-Restored Reasons'),
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser.bfcache.reason', NOT_RESTORED],
          aggregates: [NOT_RESTORED],
          columns: ['browser.bfcache.reason'],
          orderby: `-${NOT_RESTORED}`,
        },
      ],
      layout: {x: 3, y: 4, w: 3, h: 3, minH: 2},
    },
    {
      id: 'bfcache-reasons-by-route',
      title: t('BFCache Reasons by Route'),
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['sentry.transaction', 'browser.bfcache.reason', NOT_RESTORED],
          aggregates: [NOT_RESTORED],
          columns: ['sentry.transaction', 'browser.bfcache.reason'],
          orderby: `-${NOT_RESTORED}`,
        },
      ],
      layout: {x: 0, y: 7, w: 3, h: 3, minH: 2},
    },
    {
      id: 'bfcache-outcome-by-browser',
      title: t('BFCache Outcome by Browser'),
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser.name', 'browser.bfcache.outcome', NAVIGATION],
          aggregates: [NAVIGATION],
          columns: ['browser.name', 'browser.bfcache.outcome'],
          orderby: `-${NAVIGATION}`,
        },
      ],
      layout: {x: 3, y: 7, w: 3, h: 3, minH: 2},
    },
    {
      id: 'bfcache-blockers-by-frame',
      title: t('BFCache Blockers by Frame'),
      displayType: DisplayType.CATEGORICAL_BAR,
      widgetType: WidgetType.TRACEMETRICS,
      interval: INTERVAL,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['browser.bfcache.frame', NOT_RESTORED],
          aggregates: [NOT_RESTORED],
          columns: ['browser.bfcache.frame'],
          orderby: `-${NOT_RESTORED}`,
        },
      ],
      layout: {x: 0, y: 10, w: 3, h: 2, minH: 2},
    },
  ],
  onboarding: {
    type: 'custom',
    componentId: 'bfcache-metrics',
    // bfcache is browser-only, so gate on a frontend-data proxy. There is no
    // bfcache-specific project flag; the data only exists once the SDK's
    // bfcacheMetricsIntegration is enabled.
    requiredProjectFlags: ['hasInsightsVitals'],
  },
};
