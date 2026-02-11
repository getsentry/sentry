import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_CONDITION = 'is_transaction:true transaction.op:[ui.load,navigation]';
const SPAN_OPERATIONS_CONDITION =
  'transaction.op:[ui.load,navigation] has:span.description span.op:[file.read,file.write,ui.load,navigation,http.client,db,db.sql.room,db.sql.query,db.sql.transaction]';

const avgTTIDBigNumberWidget: Widget = {
  id: 'avg-ttid-big-number',
  title: 'Average TTID',
  description: '',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`],
      columns: [],
      conditions: TRANSACTION_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    h: 1,
    x: 0,
    y: 0,
    w: 2,
    minH: 1,
  },
};

const avgTTFDBigNumberWidget: Widget = {
  id: 'avg-ttfd-big-number',
  title: 'Average TTFD',
  description: '',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`],
      columns: [],
      conditions: TRANSACTION_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    h: 1,
    x: 2,
    y: 0,
    w: 2,
    minH: 1,
  },
};

const totalCountBigNumberWidget: Widget = {
  id: 'total-count-big-number',
  title: 'Total Count',
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
      conditions: TRANSACTION_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    h: 1,
    x: 4,
    y: 0,
    w: 2,
    minH: 1,
  },
};

const averageTTIDLineWidget: Widget = {
  id: 'average-ttid-line',
  title: 'Average TTID',
  description: '',
  displayType: DisplayType.LINE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: 'TTID',
      fields: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`],
      columns: [],
      fieldAliases: [],
      conditions: TRANSACTION_CONDITION,
      orderby: 'avg(measurements.time_to_initial_display)',
    },
  ],
  layout: {
    h: 2,
    x: 0,
    y: 1,
    w: 2,
    minH: 2,
  },
};

const averageTTFDLineWidget: Widget = {
  id: 'average-ttfd-line',
  title: 'Average TTFD',
  description: '',
  displayType: DisplayType.LINE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: 'TTFD',
      fields: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`],
      columns: [],
      fieldAliases: [],
      conditions: TRANSACTION_CONDITION,
      orderby: 'avg(measurements.time_to_full_display)',
    },
  ],
  layout: {
    h: 2,
    x: 2,
    y: 1,
    w: 2,
    minH: 2,
  },
};

const totalCountLineWidget: Widget = {
  id: 'total-count-line',
  title: 'Total Count',
  description: '',
  displayType: DisplayType.LINE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`count(${SpanFields.SPAN_DURATION})`],
      aggregates: [`count(${SpanFields.SPAN_DURATION})`],
      columns: [],
      fieldAliases: [],
      conditions: TRANSACTION_CONDITION,
      orderby: `count(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    h: 2,
    x: 4,
    y: 1,
    w: 2,
    minH: 2,
  },
};

const TTIDBarChartWidget: Widget = {
  id: 'ttid-device-class-bar',
  title: 'TTID by Device Class',
  description: '',
  displayType: DisplayType.CATEGORICAL_BAR,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.DEVICE_CLASS,
        `avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`,
      ],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`],
      columns: [SpanFields.DEVICE_CLASS],
      fieldAliases: ['Device Class', 'AVG TTID'],
      conditions: TRANSACTION_CONDITION,
      orderby: `${SpanFields.DEVICE_CLASS}`,
    },
  ],
  layout: {
    h: 2,
    x: 0,
    y: 4,
    w: 2,
    minH: 2,
  },
};

const TTFDBarChartWidget: Widget = {
  id: 'ttfd-device-class-br',
  title: 'TTFD by Device Class',
  description: '',
  displayType: DisplayType.CATEGORICAL_BAR,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.DEVICE_CLASS,
        `avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`,
      ],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`],
      columns: [SpanFields.DEVICE_CLASS],
      fieldAliases: ['Device Class', 'AVG TTFD'],
      conditions: TRANSACTION_CONDITION,
      orderby: `${SpanFields.DEVICE_CLASS}`,
    },
  ],
  layout: {
    h: 2,
    x: 2,
    y: 4,
    w: 2,
    minH: 2,
  },
};

const spanOperationsTable: Widget = {
  id: 'span-operations-table',
  title: 'Span Operations',
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
        `ttid_contribution_rate()`,
        `ttfd_contribution_rate()`,
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      aggregates: [
        `ttid_contribution_rate()`,
        `ttfd_contribution_rate()`,
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      columns: [SpanFields.SPAN_OP, SpanFields.SPAN_DESCRIPTION],
      fieldAliases: [
        'Operation',
        'Span Description',
        'TTID Contribution Rate',
        'TTFD Contribution Rate',
        'Avg Self Time',
        'Total Time Spent',
      ],
      conditions: SPAN_OPERATIONS_CONDITION,
      orderby: '-sum(span.self_time)',
    },
  ],
  layout: {
    h: 4,
    x: 0,
    y: 6,
    w: 6,
    minH: 2,
  },
};

const headerRowWidgets: Widget[] = [
  avgTTIDBigNumberWidget,
  avgTTFDBigNumberWidget,
  totalCountBigNumberWidget,
];

const secondRowWidgets: Widget[] = [
  averageTTIDLineWidget,
  averageTTFDLineWidget,
  totalCountLineWidget,
];

const thirdRowWidgets: Widget[] = [TTIDBarChartWidget, TTFDBarChartWidget];

export const MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals Screen Loads'),
  projects: [],
  widgets: [
    ...headerRowWidgets,
    ...secondRowWidgets,
    ...thirdRowWidgets,
    spanOperationsTable,
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
          key: SpanFields.SPAN_OP,
          name: SpanFields.SPAN_OP,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
};
