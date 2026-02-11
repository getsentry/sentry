import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_OP_CONDITION = `${SpanFields.TRANSACTION_OP}:[ui.load,navigation]`;
const COLD_START_CONDITION = `${SpanFields.SPAN_OP}:app.start.cold ${SpanFields.SPAN_DESCRIPTION}:["Cold Start","Cold App Start"]`;
const WARM_START_CONDITION = `${SpanFields.SPAN_OP}:app.start.warm ${SpanFields.SPAN_DESCRIPTION}:["Warm Start","Warm App Start"]`;

const COLD_START_TABLE_OPERATIONS_CONDITION = `!${SpanFields.SPAN_DESCRIPTION}:"Cold Start" !${SpanFields.SPAN_DESCRIPTION}:"Warm Start" !${SpanFields.SPAN_DESCRIPTION}:"Cold App Start" !${SpanFields.SPAN_DESCRIPTION}:"Warm App Start" !${SpanFields.SPAN_DESCRIPTION}:"Initial Frame Render" has:${SpanFields.SPAN_DESCRIPTION} ${SpanFields.TRANSACTION_OP}:[ui.load,navigation] has:ttid app_start_type:cold ${SpanFields.SPAN_OP}:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]`;

const WARM_START_TABLE_OPERATIONS_CONDITION = `!${SpanFields.SPAN_DESCRIPTION}:"Cold Start" !${SpanFields.SPAN_DESCRIPTION}:"Warm Start" !${SpanFields.SPAN_DESCRIPTION}:"Cold App Start" !${SpanFields.SPAN_DESCRIPTION}:"Warm App Start" !${SpanFields.SPAN_DESCRIPTION}:"Initial Frame Render" has:${SpanFields.SPAN_DESCRIPTION} ${SpanFields.TRANSACTION_OP}:[ui.load,navigation] has:ttid app_start_type:warm ${SpanFields.SPAN_OP}:[app.start.cold,app.start.warm,contentprovider.load,application.load,activity.load,ui.load,process.load]`;

const AVG_COLD_STARTS_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-cold-starts-big-number',
  title: t('Average Cold Start'),
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

const TOTAL_COLD_START_COUNT_BIG_NUMBER_WIDGET: Widget = {
  id: 'total-cold-start-count-big-number',
  title: t('Cold Start Count'),
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

const AVG_WARM_STARTS_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-warm-starts-big-number',
  title: t('Average Warm Start'),
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

const TOTAL_WARM_START_COUNT_BIG_NUMBER_WIDGET: Widget = {
  id: 'total-warm-start-count-big-number',
  title: t('Warm Start Count'),
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

const AVG_COLD_START_LINE_WIDGET: Widget = {
  id: 'avg-cold-start-line',
  title: t('Average Cold Start'),
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

const AVG_WARM_START_LINE_WIDGET: Widget = {
  id: 'avg-warm-start-line',
  title: t('Average Warm Start'),
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

const COLD_START_DEVICE_DISTRIBUTION_WIDGET: Widget = {
  id: 'cold-start-device-distribution-bar',
  title: t('Cold Start Device Distribution'),
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

const WARM_START_DEVICE_DISTRIBUTION_WIDGET: Widget = {
  id: 'warm-start-device-distribution-bar',
  title: t('Warm Start Device Distribution'),
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

const COLD_OPERATIONS_TABLE: Widget = {
  id: 'cold-operations-table',
  title: t('Cold Start Operations'),
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
    h: 6,
    x: 0,
    y: 5,
    w: 3,
    minH: 2,
  },
};

const WARM_OPERATIONS_TABLE: Widget = {
  id: 'warm-operations-table',
  title: t('Warm Start Operations'),
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
    h: 6,
    x: 3,
    y: 5,
    w: 3,
    minH: 2,
  },
};

const HEADER_ROW_WIDGETS: Widget[] = [
  AVG_COLD_STARTS_BIG_NUMBER_WIDGET,
  AVG_WARM_STARTS_BIG_NUMBER_WIDGET,
  TOTAL_COLD_START_COUNT_BIG_NUMBER_WIDGET,
  TOTAL_WARM_START_COUNT_BIG_NUMBER_WIDGET,
];

const FIRST_ROW_WIDGETS: Widget[] = [
  AVG_COLD_START_LINE_WIDGET,
  AVG_WARM_START_LINE_WIDGET,
];

const SECOND_ROW_WIDGETS: Widget[] = [
  COLD_START_DEVICE_DISTRIBUTION_WIDGET,
  WARM_START_DEVICE_DISTRIBUTION_WIDGET,
];

export const MOBILE_VITALS_APP_STARTS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals App Starts'),
  projects: [],
  widgets: [
    ...HEADER_ROW_WIDGETS,
    ...FIRST_ROW_WIDGETS,
    ...SECOND_ROW_WIDGETS,
    COLD_OPERATIONS_TABLE,
    WARM_OPERATIONS_TABLE,
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
