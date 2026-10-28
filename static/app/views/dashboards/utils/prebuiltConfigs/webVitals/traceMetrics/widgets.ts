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
  WEB_VITAL_COUNT_FIELDS,
  WEB_VITAL_SCORE_FIELDS,
  webVitalCountField,
  webVitalP75Field,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {SCORE_BREAKDOWN_WHEEL_WIDGET} from 'sentry/views/dashboards/widgetLibrary/webVitalsWidgets';
import {ORDER, type WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {SpanFields} from 'sentry/views/insights/types';

/**
 * Pageloads. TTFB comes from navigation timing, so every pageload reports it,
 * while LCP and CLS depend on the browser and INP comes from interactions.
 */
export const PAGELOADS_FIELD = webVitalCountField('ttfb');

const INTERVAL = '5m';

export const WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS: GlobalFilter[] = [
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

/**
 * The shared wheel template, reading each vital's score and count from the
 * metrics. The ring computes the total score from these on the frontend.
 */
export function scoreBreakdownWheelWidget(layout: PrebuiltWidgetLayout): PrebuiltWidget {
  const fields = [...WEB_VITAL_SCORE_FIELDS, ...WEB_VITAL_COUNT_FIELDS];
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
