import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  SCREEN_LOAD_CONDITION,
  SCREEN_LOAD_SPAN_OPERATIONS_CONDITION,
  TRANSACTION_COUNT,
  TTFD_CONDITION,
  TTID_CONDITION,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/constants';
import {SCREEN_LOADS_DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/settings';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

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
      fields: [`avg(${SpanFields.APP_VITALS_TTID_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_TTID_VALUE})`],
      columns: [],
      conditions: TTID_CONDITION,
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
      fields: [`avg(${SpanFields.APP_VITALS_TTFD_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_TTFD_VALUE})`],
      columns: [],
      conditions: TTFD_CONDITION,
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
      fields: [TRANSACTION_COUNT],
      aggregates: [TRANSACTION_COUNT],
      columns: [],
      conditions: SCREEN_LOAD_CONDITION,
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
      fields: [`avg(${SpanFields.APP_VITALS_TTID_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_TTID_VALUE})`],
      columns: [],
      fieldAliases: [],
      conditions: TTID_CONDITION,
      orderby: `avg(${SpanFields.APP_VITALS_TTID_VALUE})`,
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
      fields: [`avg(${SpanFields.APP_VITALS_TTFD_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_TTFD_VALUE})`],
      columns: [],
      fieldAliases: [],
      conditions: TTFD_CONDITION,
      orderby: `avg(${SpanFields.APP_VITALS_TTFD_VALUE})`,
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
      fields: [TRANSACTION_COUNT],
      aggregates: [TRANSACTION_COUNT],
      columns: [],
      fieldAliases: [],
      conditions: SCREEN_LOAD_CONDITION,
      orderby: TRANSACTION_COUNT,
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
      fields: [SpanFields.DEVICE_CLASS, `avg(${SpanFields.APP_VITALS_TTID_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_TTID_VALUE})`],
      columns: [SpanFields.DEVICE_CLASS],
      fieldAliases: [t('Device Class'), 'AVG TTID'],
      conditions: TTID_CONDITION,
      orderby: SpanFields.DEVICE_CLASS,
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
      fields: [SpanFields.DEVICE_CLASS, `avg(${SpanFields.APP_VITALS_TTFD_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_TTFD_VALUE})`],
      columns: [SpanFields.DEVICE_CLASS],
      fieldAliases: [t('Device Class'), 'AVG TTFD'],
      conditions: TTFD_CONDITION,
      orderby: SpanFields.DEVICE_CLASS,
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
        SpanFields.NAME,
        SpanFields.SPAN_DESCRIPTION,
        'equation|ttid_contribution_rate()',
        'equation|ttfd_contribution_rate()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      aggregates: [
        'equation|ttid_contribution_rate()',
        'equation|ttfd_contribution_rate()',
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
      ],
      columns: [SpanFields.SPAN_OP, SpanFields.NAME, SpanFields.SPAN_DESCRIPTION],
      fieldAliases: [
        t('Operation'),
        t('Span Name'),
        t('Span Description'),
        'TTID Contribution Rate',
        'TTFD Contribution Rate',
        'Avg Self Time',
        'Total Time Spent',
      ],
      conditions: SCREEN_LOAD_SPAN_OPERATIONS_CONDITION,
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
  title: SCREEN_LOADS_DASHBOARD_TITLE,
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
          key: SpanFields.TRANSACTION,
          name: SpanFields.TRANSACTION,
          kind: FieldKind.TAG,
        },
        value: '',
      },
    ],
  },
  onboarding: {type: 'module', moduleName: ModuleName.SCREEN_LOAD},
};
