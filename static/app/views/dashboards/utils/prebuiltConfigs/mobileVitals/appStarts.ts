import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_OP_CONDITION = 'transaction.op:[ui.load,navigation]';
const COLD_START_CONDITION =
  'span.op:app.start.cold span.description:["Cold Start","Cold App Start"]';
const WARM_START_CONDITION =
  'span.op:app.start.warm span.description:["Warm Start","Warm App Start"]';

const COLD_START_TABLE_OPERATIONS_CONDITION =
  '!span.description:"Cold Start" !span.description:"Warm Start" !span.description:"Cold App Start" !span.description:"Warm App Start" !span.description:"Initial Frame Render" has:span.description transaction.op:[ui.load,navigation] has:ttid app_start_type:cold span.op:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]';

const WARM_START_TABLE_OPERATIONS_CONDITION =
  '!span.description:"Cold Start" !span.description:"Warm Start" !span.description:"Cold App Start" !span.description:"Warm App Start" !span.description:"Initial Frame Render" has:span.description transaction.op:[ui.load,navigation] has:ttid app_start_type:warm span.op:[app.start.arm,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]';

const avgColdStartsBigNumberWidget: Widget = {
  id: 'avg-cold-starts-big-number',
  title: 'Average Cold Start',
  description: '',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.SPAN_DURATION})`],
      aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
      columns: [],
      conditions: COLD_START_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    h: 1,
    x: 0,
    y: 0,
    w: 1,
    minH: 1,
  },
};

const totalColdStartCountBigNumberWidget: Widget = {
  id: 'total-cold-start-count-big-number',
  title: 'Cold Start Count',
  description: '',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`count(${SpanFields.SPAN_DURATION})`],
      aggregates: [`count(${SpanFields.SPAN_DURATION})`],
      columns: [],
      conditions: COLD_START_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    h: 1,
    x: 1,
    y: 0,
    w: 1,
    minH: 1,
  },
};

const avgWarmStartsBigNumberWidget: Widget = {
  id: 'avg-warm-starts-big-number',
  title: 'Average Warm Start',
  description: '',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.SPAN_DURATION})`],
      aggregates: [`avg(${SpanFields.SPAN_DURATION})`],
      columns: [],
      conditions: WARM_START_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    h: 1,
    x: 3,
    y: 0,
    w: 1,
    minH: 1,
  },
};

const totalWarmStartCountBigNumberWidget: Widget = {
  id: 'total-warm-start-count-big-number',
  title: 'Warm Start Count',
  description: '',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`count(${SpanFields.SPAN_DURATION})`],
      aggregates: [`count(${SpanFields.SPAN_DURATION})`],
      columns: [],
      conditions: WARM_START_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    h: 1,
    x: 4,
    y: 0,
    w: 1,
    minH: 1,
  },
};

const avgColdStartLineWidget: Widget = {
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
      orderby: `-avg(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    h: 2,
    x: 0,
    y: 1,
    w: 3,
    minH: 2,
  },
};

const avgWarmStartLineWidget: Widget = {
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
      orderby: `-avg(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    h: 2,
    x: 3,
    y: 1,
    w: 3,
    minH: 2,
  },
};

const coldStartDeviceDistributionWidget: Widget = {
  id: 'cold-start-device-distribution-bar',
  title: 'Cold Start Device Distribution',
  description: '',
  displayType: DisplayType.CATEGORICAL_BAR,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [SpanFields.DEVICE_CLASS, `avg(${SpanFields.APP_START_COLD})`],
      aggregates: [`avg(${SpanFields.APP_START_COLD})`],
      columns: [SpanFields.DEVICE_CLASS],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: `${SpanFields.DEVICE_CLASS}`,
    },
  ],
  layout: {
    h: 2,
    x: 0,
    y: 3,
    w: 3,
    minH: 2,
  },
};

const warmStartDeviceDistributionWidget: Widget = {
  id: 'warm-start-device-distribution-bar',
  title: 'Warm Start Device Distribution',
  description: '',
  displayType: DisplayType.CATEGORICAL_BAR,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [SpanFields.DEVICE_CLASS, `avg(${SpanFields.APP_START_WARM})`],
      aggregates: [`avg(${SpanFields.APP_START_WARM})`],
      columns: [SpanFields.DEVICE_CLASS],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: `${SpanFields.DEVICE_CLASS}`,
    },
  ],
  layout: {
    h: 2,
    x: 3,
    y: 3,
    w: 3,
    minH: 2,
  },
};

const coldOperationsTable: Widget = {
  id: 'cold-operations-table',
  title: 'Cold Start Operations',
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
      fieldAliases: ['Operation', 'Span Description', 'Average Duration'],
      conditions: COLD_START_TABLE_OPERATIONS_CONDITION,
      orderby: '-avg(span.self_time)',
    },
  ],
  layout: {
    x: 0,
    minH: 6,
    w: 3,
    y: 5,
    h: 6,
  },
};

const warmOperationsTable: Widget = {
  id: 'warm-operations-table',
  title: 'Warm Start Operations',
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
      fieldAliases: ['Operation', 'Span Description', 'Average Duration'],
      conditions: WARM_START_TABLE_OPERATIONS_CONDITION,
      orderby: '-avg(span.self_time)',
    },
  ],
  layout: {
    x: 3,
    minH: 6,
    w: 3,
    y: 5,
    h: 6,
  },
};

const headerRowWidgets: Widget[] = [
  avgColdStartsBigNumberWidget,
  avgWarmStartsBigNumberWidget,
  totalColdStartCountBigNumberWidget,
  totalWarmStartCountBigNumberWidget,
];

const firstRowWidgets: Widget[] = [avgColdStartLineWidget, avgWarmStartLineWidget];

const secondRowWidgets: Widget[] = [
  coldStartDeviceDistributionWidget,
  warmStartDeviceDistributionWidget,
];

export const MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals App Starts'),
  projects: [],
  widgets: [
    ...headerRowWidgets,
    ...firstRowWidgets,
    ...secondRowWidgets,
    ...[coldOperationsTable, warmOperationsTable],
  ],
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
