import {DurationUnit, type DataUnit} from 'sentry/utils/discover/fields';
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
import {traceMetricField} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/traceMetricField';
import {SCORE_BREAKDOWN_WHEEL_WIDGET} from 'sentry/views/dashboards/widgetLibrary/webVitalsWidgets';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {SpanFields} from 'sentry/views/insights/types';

/**
 * Relay emits one `browser.web_vital.<vital>` distribution per vital for every
 * indexed pageload or interaction span. The metric value is the raw vital and
 * the scores ride along as numeric attributes, which the backend
 * `performance_score`, `opportunity_score` and `count_scores` formulas read.
 * Those formulas take the same `measurements.score.<vital>` argument as the
 * spans versions, so the score fields below are shared with the spans configs.
 */
const WEB_VITAL_METRIC_UNITS: Record<WebVitals, DataUnit> = {
  lcp: DurationUnit.MILLISECOND,
  fcp: DurationUnit.MILLISECOND,
  inp: DurationUnit.MILLISECOND,
  ttfb: DurationUnit.MILLISECOND,
  cls: null,
};

export function webVitalP75Field(vital: WebVitals): string {
  return traceMetricField(
    'p75',
    `browser.web_vital.${vital}`,
    'distribution',
    WEB_VITAL_METRIC_UNITS[vital]
  );
}

/** Distinct pageloads with at least one web vital score. */
export const PAGELOADS_FIELD = 'count_scores(measurements.score.total)';

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

/** The shared wheel template with its spans-only conditions dropped. */
export function scoreBreakdownWheelWidget(layout: PrebuiltWidgetLayout): PrebuiltWidget {
  return {
    ...SCORE_BREAKDOWN_WHEEL_WIDGET,
    widgetType: WidgetType.TRACEMETRICS,
    queries: SCORE_BREAKDOWN_WHEEL_WIDGET.queries.map(query => ({
      ...query,
      conditions: '',
    })),
    layout,
  };
}

export const SCORE_BREAKDOWN_FIELDS = [
  'performance_score(measurements.score.lcp)',
  'performance_score(measurements.score.fcp)',
  'performance_score(measurements.score.inp)',
  'performance_score(measurements.score.cls)',
  'performance_score(measurements.score.ttfb)',
];

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
        fields: SCORE_BREAKDOWN_FIELDS,
        aggregates: SCORE_BREAKDOWN_FIELDS,
        columns: [],
        orderby: '',
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
