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
  webVitalMetricName,
  webVitalP75Field,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {SCORE_BREAKDOWN_WHEEL_WIDGET} from 'sentry/views/dashboards/widgetLibrary/webVitalsWidgets';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {ORDER, type WebVitals} from 'sentry/views/insights/browser/webVitals/types';

/**
 * Pageloads. TTFB comes from navigation timing, so every pageload reports it.
 */
export const PAGELOADS_FIELD = webVitalCountField('ttfb');

export const INTERACTIONS_FIELD = webVitalCountField('inp');

const INTERVAL = '5m';

export const WEB_VITALS_TRACE_METRICS_GLOBAL_FILTERS: GlobalFilter[] = [
  TraceMetricKnownFieldKey.USER_GEO_SUBREGION,
  TraceMetricKnownFieldKey.BROWSER_NAME,
  TraceMetricKnownFieldKey.BROWSER_NAVIGATION_TYPE,
].map(key => ({
  dataset: WidgetType.TRACEMETRICS,
  tag: {key, name: key, kind: FieldKind.TAG},
  value: '',
}));

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

type SamplesTableOptions = {
  id: string;
  layout: PrebuiltWidgetLayout;
  title: string;
  vital: WebVitals;
  extraFields?: string[];
  tableWidths?: number[];
};

/**
 * Lists single web vital metrics. The table query sends no metric params, so
 * the conditions narrow to the vital's metric the same way Explore's samples
 * table does.
 */
export function webVitalSamplesTable({
  vital,
  id,
  title,
  extraFields = [],
  tableWidths,
  layout,
}: SamplesTableOptions): PrebuiltWidget {
  const fields = [
    TraceMetricKnownFieldKey.PROJECT,
    TraceMetricKnownFieldKey.TRACE,
    ...extraFields,
    TraceMetricKnownFieldKey.METRIC_VALUE,
    TraceMetricKnownFieldKey.PROFILE_ID,
    TraceMetricKnownFieldKey.REPLAY_ID_ALIAS,
    TraceMetricKnownFieldKey.TIMESTAMP,
  ];
  return {
    id,
    title,
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.TRACEMETRICS,
    interval: INTERVAL,
    tableWidths,
    queries: [
      {
        name: '',
        conditions: `${TraceMetricKnownFieldKey.METRIC_NAME}:${webVitalMetricName(vital)} ${TraceMetricKnownFieldKey.METRIC_TYPE}:distribution`,
        fields,
        aggregates: [],
        columns: fields,
        orderby: `-${TraceMetricKnownFieldKey.TIMESTAMP}`,
        fieldAliases: fields.map(field =>
          field === TraceMetricKnownFieldKey.METRIC_VALUE ? vital.toUpperCase() : ''
        ),
      },
    ],
    layout,
  };
}
