import {FieldKind} from 'sentry/utils/fields';
import {
  DisplayType,
  WidgetType,
  type GlobalFilter,
  type SlideoutId,
  type Widget,
} from 'sentry/views/dashboards/types';
import type {
  PrebuiltWidget,
  PrebuiltWidgetLayout,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  WEB_VITAL_SCORE_COUNT_FIELDS,
  WEB_VITAL_SCORE_FIELDS,
  webVitalCountField,
  webVitalP75Field,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {SCORE_BREAKDOWN_WHEEL_WIDGET} from 'sentry/views/dashboards/widgetLibrary/webVitalsWidgets';
import {ORDER, type WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {SpanFields} from 'sentry/views/insights/types';

/**
 * Pageloads. TTFB comes from navigation timing, so every pageload reports it.
 */
export const PAGELOADS_FIELD = webVitalCountField('ttfb');

const INTERVAL = '5m';

// TODO: These filters are declared for trace metrics only, so they do not reach
// the widgets that still query spans. The navigation type switcher also writes a
// spans filter (`buildNavigationTypeGlobalFilter`), so the metrics widgets
// ignore it. Both resolve once every widget here is on trace metrics. The geo
// filter needs Relay to copy geo attributes onto the web vital metrics
// (getsentry/relay#6576) before it matches anything.
export const WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS: GlobalFilter[] = [
  {
    dataset: WidgetType.TRACEMETRICS,
    tag: {
      key: 'user.geo.subregion',
      name: 'user.geo.subregion',
      kind: FieldKind.TAG,
    },
    value: '',
  },
  {
    dataset: WidgetType.TRACEMETRICS,
    tag: {
      key: SpanFields.BROWSER_NAME,
      name: SpanFields.BROWSER_NAME,
      kind: FieldKind.TAG,
    },
    value: '',
  },
  {
    dataset: WidgetType.TRACEMETRICS,
    tag: {
      key: SpanFields.BROWSER_NAVIGATION_TYPE,
      name: SpanFields.BROWSER_NAVIGATION_TYPE,
      kind: FieldKind.TAG,
    },
    value: '',
  },
];

export function scoreBreakdownWheelWidget(layout: PrebuiltWidgetLayout): PrebuiltWidget {
  const fields = [...WEB_VITAL_SCORE_FIELDS, ...WEB_VITAL_SCORE_COUNT_FIELDS];
  return {
    ...SCORE_BREAKDOWN_WHEEL_WIDGET,
    widgetType: WidgetType.TRACEMETRICS,
    queries: [
      {
        name: '',
        conditions: '',
        fields,
        aggregates: [],
        columns: fields,
        orderby: '',
      },
    ],
    layout,
  };
}

export function scoreBreakdownChartWidget(
  title: string,
  description: string,
  layout: PrebuiltWidgetLayout
): PrebuiltWidget {
  return {
    id: 'score-breakdown-chart',
    title,
    description,
    displayType: DisplayType.AREA,
    widgetType: WidgetType.TRACEMETRICS,
    interval: INTERVAL,
    queries: [
      {
        name: '',
        conditions: '',
        fields: WEB_VITAL_SCORE_FIELDS,
        aggregates: WEB_VITAL_SCORE_FIELDS,
        columns: [],
        orderby: '',
        // The raw metric fields are long, so label the series by vital
        fieldAliases: ORDER.map(vital => vital.toUpperCase()),
      },
    ],
    layout,
  };
}

type MeterOptions = {
  description: string;
  id: string;
  layout: PrebuiltWidgetLayout;
  slideOutId: SlideoutId;
  thresholds: NonNullable<Widget['thresholds']>;
  title: string;
  vital: WebVitals;
};

export function webVitalP75Meter({
  vital,
  id,
  title,
  description,
  thresholds,
  slideOutId,
  layout,
}: MeterOptions): PrebuiltWidget {
  const field = webVitalP75Field(vital);
  return {
    id,
    title,
    description,
    displayType: DisplayType.BIG_NUMBER,
    widgetType: WidgetType.TRACEMETRICS,
    interval: INTERVAL,
    queries: [
      {
        name: '',
        conditions: '',
        fields: [field],
        aggregates: [field],
        columns: [],
        orderby: '',
        slideOutId,
      },
    ],
    thresholds,
    layout,
  };
}
