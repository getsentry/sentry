import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_CONDITION = `is_transaction:true ${SpanFields.TRANSACTION_OP}:[ui.load,navigation]`;
const SPAN_OPERATIONS_CONDITION = `${SpanFields.TRANSACTION_OP}:[ui.load,navigation] has:${SpanFields.SPAN_DESCRIPTION} ${SpanFields.SPAN_OP}:[file.read,file.write,ui.load,navigation,http.client,db,db.sql.room,db.sql.query,db.sql.transaction]`;

const AVG_TTID_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-ttid-big-number',
  title: t('Average TTID'),
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

const AVG_TTFD_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-ttfd-big-number',
  title: t('Average TTFD'),
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

const TOTAL_COUNT_BIG_NUMBER_WIDGET: Widget = {
  id: 'total-count-big-number',
  title: t('Total Count'),
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

const AVG_TTID_LINE_WIDGET: Widget = {
  id: 'average-ttid-line',
  title: t('Average TTID'),
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

const AVG_TTFD_LINE_WIDGET: Widget = {
  id: 'average-ttfd-line',
  title: t('Average TTFD'),
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

const TOTAL_COUNT_LINE_WIDGET: Widget = {
  id: 'total-count-line',
  title: t('Total Count'),
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

const TTID_BAR_CHART_WIDGET: Widget = {
  id: 'ttid-device-class-bar',
  title: t('TTID by Device Class'),
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
    y: 3,
    w: 2,
    minH: 2,
  },
};

const TTFD_BAR_CHART_WIDGET: Widget = {
  id: 'ttfd-device-class-bar',
  title: t('TTFD by Device Class'),
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
    y: 3,
    w: 2,
    minH: 2,
  },
};

const SPAN_OPERATIONS_TABLE: Widget = {
  id: 'span-operations-table',
  title: t('Span Operations'),
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
    y: 5,
    w: 6,
    minH: 2,
  },
};

const HEADER_ROW_WIDGETS: Widget[] = [
  AVG_TTID_BIG_NUMBER_WIDGET,
  AVG_TTFD_BIG_NUMBER_WIDGET,
  TOTAL_COUNT_BIG_NUMBER_WIDGET,
];

const SECOND_ROW_WIDGETS: Widget[] = [
  AVG_TTID_LINE_WIDGET,
  AVG_TTFD_LINE_WIDGET,
  TOTAL_COUNT_LINE_WIDGET,
];

const THIRD_ROW_WIDGETS: Widget[] = [TTID_BAR_CHART_WIDGET, TTFD_BAR_CHART_WIDGET];

export const MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals Screen Loads'),
  projects: [],
  widgets: [
    ...HEADER_ROW_WIDGETS,
    ...SECOND_ROW_WIDGETS,
    ...THIRD_ROW_WIDGETS,
    SPAN_OPERATIONS_TABLE,
  ],
  filters: {
    globalFilter: [
      {
        dataset: WidgetType.SPANS,
        tag: {
          key: 'os.name',
          name: 'os.name',
          kind: FieldKind.TAG,
        },
        value: '',
      },
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
