import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields} from 'sentry/views/insights/types';

const COLD_START_CONDITION =
  'span.op:app.start.cold span.description:["Cold Start","Cold App Start"]';
const WARM_START_CONDITION =
  'span.op:app.start.warm span.description:["Warm Start","Warm App Start"]';
const OPERATIONS_CONDITION =
  '!span.description:"Cold Start" !span.description:"Warm Start" !span.description:"Cold App Start" !span.description:"Warm App Start" !span.description:"Initial Frame Render" has:span.description transaction.op:[ui.load,navigation] has:ttid app_start_type:cold span.op:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]';

// First row widgets (charts)
const firstRowWidgets: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'avg-cold-start-line',
      title: 'Average Cold Start',
      description: '',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: [`avg(${SpanFields.SPAN_DURATION})`],
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [],
          fieldAliases: [],
          conditions: COLD_START_CONDITION,
          orderby: `avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'cold-start-device-distribution-table',
      title: 'Cold Start Device Distribution',
      description: '',
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: [SpanFields.DEVICE_CLASS, `avg(${SpanFields.APP_START_COLD})`],
          aggregates: [`avg(${SpanFields.APP_START_COLD})`],
          columns: [SpanFields.DEVICE_CLASS],
          fieldAliases: ['', ''],
          conditions: '',
          orderby: '-avg(measurements.app_start_cold)',
        },
      ],
    },
  ],
  0
);

// Second row widgets
const secondRowWidgets: Widget[] = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'avg-warm-start-line',
      title: 'Average Warm Start',
      description: '',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: [`avg(${SpanFields.SPAN_DURATION})`],
          aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
          columns: [],
          fieldAliases: [],
          conditions: WARM_START_CONDITION,
          orderby: `avg(${SpanFields.SPAN_DURATION})`,
        },
      ],
    },
    {
      id: 'warm-start-device-distribution-table',
      title: 'Warm Start Device Distribution',
      description: '',
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.SPANS,
      interval: '1h',
      thresholds: null,
      queries: [
        {
          name: '',
          fields: [SpanFields.DEVICE_CLASS, `avg(${SpanFields.APP_START_WARM})`],
          aggregates: [`avg(${SpanFields.APP_START_WARM})`],
          columns: [SpanFields.DEVICE_CLASS],
          fieldAliases: ['', ''],
          conditions: '',
          orderby: '-avg(measurements.app_start_warm)',
        },
      ],
    },
  ],
  2
);

// Operations table (full width)
const operationsTable: Widget = {
  id: 'operations-table',
  title: 'Operations',
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.SPAN_OP,
        SpanFields.SPAN_DESCRIPTION,
        `avg(${SpanFields.SPAN_SELF_TIME})`,
      ],
      aggregates: [`avg(${SpanFields.SPAN_SELF_TIME})`],
      columns: [SpanFields.SPAN_OP, SpanFields.SPAN_DESCRIPTION],
      fieldAliases: ['Operation', 'Description', 'AVG Duration'],
      conditions: OPERATIONS_CONDITION,
      orderby: '-avg(span.self_time)',
    },
  ],
  layout: {
    x: 0,
    minH: 2,
    w: 6,
    y: 4,
    h: 6,
  },
};

// Span events table (full width)
const spanEventsTable: Widget = {
  id: 'span-events-table',
  title: 'Span Events',
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [SpanFields.ID, SpanFields.SPAN_DURATION, SpanFields.SPAN_DURATION],
      aggregates: [],
      columns: [SpanFields.ID, SpanFields.SPAN_DURATION, SpanFields.SPAN_DURATION],
      fieldAliases: ['Transaction id', 'Profile', ''],
      conditions: '',
      orderby: '-id',
    },
  ],
  layout: {
    x: 0,
    minH: 2,
    w: 6,
    y: 10,
    h: 4,
  },
};

export const MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals App Start as a Dashboard'),
  projects: [],
  widgets: [...firstRowWidgets, ...secondRowWidgets, operationsTable, spanEventsTable],
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'transaction',
          name: 'transaction',
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.SPAN_OP,
          name: SpanFields.SPAN_OP,
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: SpanFields.DEVICE_CLASS,
          name: SpanFields.DEVICE_CLASS,
          kind: FieldKind.TAG,
        },
        value: '',
      },
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'user.geo.region',
          name: 'user.geo.region',
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
};
