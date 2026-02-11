import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_CONDITION = 'is_transaction:true transaction.op:[ui.load,navigation]';
const SPAN_OPERATIONS_CONDITION =
  'transaction.op:[ui.load,navigation] has:span.description span.op:[file.read,file.write,ui.load,navigation,http.client,db,db.sql.room,db.sql.query,db.sql.transaction]';

const avgTTIDBigNumberWidget: Widget = {
  id: 'avg-ttid-big-number',
  title: 'Avg TTID',
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
};

const avgTTFDBigNumberWidget: Widget = {
  id: 'avg-ttfd-big-number',
  title: 'Avg TTFD',
  description: '',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY})`],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY})`],
      columns: [],
      conditions: TRANSACTION_CONDITION,
      orderby: '',
    },
  ],
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
};

const headerRowWidgets: Widget[] = spaceWidgetsEquallyOnRow(
  [avgTTIDBigNumberWidget, avgTTFDBigNumberWidget, totalCountBigNumberWidget],
  0,
  {h: 1, minH: 1}
);

const TTIDDeviceClassTableWidget: Widget = {
  id: 'ttid-device-class-table',
  title: 'TTID by Device Class',
  description: '',
  displayType: DisplayType.TABLE,
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
      orderby: '-device.class',
    },
  ],
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
};

const secondRowWidgets: Widget[] = spaceWidgetsEquallyOnRow(
  [TTIDDeviceClassTableWidget, averageTTIDLineWidget, totalCountLineWidget],
  1
);

const TTFDDeviceClassTableWidget: Widget = {
  id: 'ttfd-device-class-table',
  title: 'TTFD by Device Class',
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.DEVICE_CLASS,
        `avg(${SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY})`,
      ],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY})`],
      columns: [SpanFields.DEVICE_CLASS],
      fieldAliases: ['Device Class', 'AVG TTFD'],
      conditions: TRANSACTION_CONDITION,
      orderby: '-device.class',
    },
  ],
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
      fields: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY})`],
      aggregates: [`avg(${SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY})`],
      columns: [],
      fieldAliases: [],
      conditions: TRANSACTION_CONDITION,
      orderby: 'avg(measurements.time_to_full_display)',
    },
  ],
};

const thirdRowWidgets: Widget[] = spaceWidgetsEquallyOnRow(
  [TTFDDeviceClassTableWidget, averageTTFDLineWidget],
  3,
  {h: 2, minH: 2}
);

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
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      aggregates: [
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      columns: [SpanFields.SPAN_OP, SpanFields.SPAN_DESCRIPTION],
      fieldAliases: ['Operation', '', '', ''],
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
      fields: [
        SpanFields.TRACE,
        SpanFields.ID,
        SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY,
        SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY,
      ],
      aggregates: [],
      columns: [
        SpanFields.TRACE,
        SpanFields.ID,
        SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY,
        SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY,
      ],
      conditions: 'span.op:[ui.load,navigation] is_transaction:true',
      orderby: '-measurements.time_to_initial_display',
    },
  ],
  layout: {
    h: 4,
    x: 0,
    y: 9,
    w: 6,
    minH: 2,
  },
};

export const MOBILE_VITALS_SCREEN_LOADS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals Screen Load as a Dashboard'),
  projects: [],
  widgets: [
    ...headerRowWidgets,
    ...secondRowWidgets,
    ...thirdRowWidgets,
    spanOperationsTable,
    spanEventsTable,
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
