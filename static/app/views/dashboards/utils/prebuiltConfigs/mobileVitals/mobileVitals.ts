import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import {type PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_OP_CONDITION = 'transaction.op:[ui.load,navigation]';

const coldStartBigNumberWidget: Widget = {
  id: 'cold-start-big-number',
  title: 'Avg. Cold App Start',
  description: 'Average cold app start duration',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: {
    max_values: {
      max1: 3000,
      max2: 5000,
    },
    unit: null,
  },
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.APP_START_COLD})`],
      aggregates: [`avg(${SpanFields.APP_START_COLD})`],
      columns: [],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    y: 1,
    h: 1,
    x: 0,
    minH: 1,
    w: 1,
  },
};

const warmStartBigNumberWidget: Widget = {
  id: 'warm-start-big-number',
  title: 'Avg. Warm App Start',
  description: 'Average warm app start duration',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: {
    max_values: {
      max1: 1000,
      max2: 2000,
    },
    unit: null,
  },
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.APP_START_WARM})`],
      aggregates: [`avg(${SpanFields.APP_START_WARM})`],
      columns: [],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    y: 1,
    h: 1,
    x: 1,
    minH: 1,
    w: 1,
  },
};

const avgTTIDBigNumberWidget: Widget = {
  id: 'avg-ttid-big-number',
  title: 'Avg. TTID',
  description: 'Average time to initial display',
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
      conditions: TRANSACTION_OP_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    y: 1,
    h: 1,
    x: 2,
    minH: 1,
    w: 1,
  },
};

const avgTTFDBigNumberWidget: Widget = {
  id: 'avg-ttfd-big-number',
  title: 'Avg. TTFD',
  description: 'Average time to full display',
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
      conditions: TRANSACTION_OP_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    y: 1,
    h: 1,
    x: 3,
    minH: 1,
    w: 1,
  },
};

const slowFrameRateWidget: Widget = {
  id: 'slow-frame-rate-big-number',
  title: 'Slow Frame Rate',
  description: 'The percentage of frames that were slow',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        `sum(${SpanFields.MOBILE_SLOW_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_SLOW_FRAMES}) / sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
      ],
      aggregates: [
        `sum(${SpanFields.MOBILE_SLOW_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_SLOW_FRAMES}) / sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
      ],
      fieldMeta: [
        null,
        null,
        {
          valueType: 'percentage',
          valueUnit: null,
        },
      ],
      selectedAggregate: 2,
      columns: [],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    y: 0,
    h: 1,
    x: 0,
    minH: 1,
    w: 2,
  },
};

const frozenFrameRateWidget: Widget = {
  id: 'frozen-frame-rate-big-number',
  title: 'Frozen Frame Rate',
  description: 'The percentage of frames that were frozen',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        `sum(${SpanFields.MOBILE_FROZEN_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_FROZEN_FRAMES}) / sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
      ],
      aggregates: [
        `sum(${SpanFields.MOBILE_FROZEN_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_FROZEN_FRAMES}) / sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
      ],
      fieldMeta: [
        null,
        null,
        {
          valueType: 'percentage',
          valueUnit: null,
        },
      ],
      selectedAggregate: 2,
      columns: [],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    y: 0,
    h: 1,
    x: 2,
    minH: 1,
    w: 2,
  },
};

const avgFrameDelayWidget: Widget = {
  id: 'avg-frame-delay-big-number',
  title: 'Avg. Frame Delay',
  description: 'Average frame delay',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.MOBILE_FRAMES_DELAY})`],
      aggregates: [`avg(${SpanFields.MOBILE_FRAMES_DELAY})`],
      columns: [],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: '',
    },
  ],
  layout: {
    y: 0,
    h: 1,
    x: 4,
    minH: 1,
    w: 2,
  },
};

const appStartTable: Widget = {
  id: 'app-start-table',
  title: 'App Starts',
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `avg(${SpanFields.APP_START_COLD})`,
        `avg(${SpanFields.APP_START_WARM})`,
        `count(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        `avg(${SpanFields.APP_START_COLD})`,
        `avg(${SpanFields.APP_START_WARM})`,
        `count(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: ['Screen', 'Cold Start', 'Warm Start', 'Screen Loads'],
      conditions: '',
      orderby: '-count(span.duration)',
      linkedDashboards: [
        {
          field: 'transaction',
          dashboardId: '-1',
          staticDashboardId: 9,
        },
      ],
    },
  ],
  layout: {
    x: 0,
    h: 3,
    y: 2,
    minH: 2,
    w: 6,
  },
};

const screenRenderingTable: Widget = {
  id: 'screen-rendering-table',
  title: 'Screen Rendering',
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `sum(${SpanFields.MOBILE_SLOW_FRAMES})`,
        `sum(${SpanFields.MOBILE_FROZEN_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_SLOW_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_FROZEN_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `count(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        `sum(${SpanFields.MOBILE_SLOW_FRAMES})`,
        `sum(${SpanFields.MOBILE_FROZEN_FRAMES})`,
        `sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_SLOW_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `equation|sum(${SpanFields.MOBILE_FROZEN_FRAMES})/sum(${SpanFields.MOBILE_TOTAL_FRAMES})`,
        `count(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: [
        'Transaction',
        'Slow Frames',
        'Frozen Frames',
        'Total Frames',
        'Slow Frame %',
        'Frozen Frame %',
        'Screen Loads',
      ],
      fieldMeta: [
        null,
        {valueType: 'integer', valueUnit: null},
        {valueType: 'integer', valueUnit: null},
        {valueType: 'integer', valueUnit: null},
        {valueType: 'percentage', valueUnit: null},
        {valueType: 'percentage', valueUnit: null},
        {valueType: 'integer', valueUnit: null},
      ],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: `-count(${SpanFields.SPAN_DURATION})`,
    },
  ],
  layout: {
    x: 0,
    h: 3,
    y: 8,
    minH: 2,
    w: 6,
  },
};

const screenLoadTable: Widget = {
  id: 'screen-load-table',
  title: 'Screen Loads',
  description: '',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`,
        `avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`,
        `count(${SpanFields.SPAN_DURATION})`,
      ],
      aggregates: [
        `avg(${SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY})`,
        `avg(${SpanFields.MEASUREMENTS_TIME_TO_FULL_DISPLAY})`,
        `count(${SpanFields.SPAN_DURATION})`,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: ['Screen', 'TTID', 'TTFD', 'Screen Loads'],
      conditions: '',
      orderby: '-count(span.duration)',
      linkedDashboards: [
        {
          field: 'transaction',
          dashboardId: '-1',
          staticDashboardId: 10,
        },
      ],
    },
  ],
  layout: {
    x: 0,
    h: 3,
    y: 5,
    minH: 2,
    w: 6,
  },
};

const firstRowWidgets: Widget[] = [
  slowFrameRateWidget,
  frozenFrameRateWidget,
  avgFrameDelayWidget,
];

const secondRowWidgets: Widget[] = [
  coldStartBigNumberWidget,
  warmStartBigNumberWidget,
  avgTTIDBigNumberWidget,
  avgTTFDBigNumberWidget,
];

export const MOBILE_VITALS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals as a Dashboard'),
  projects: [],
  widgets: [
    ...firstRowWidgets,
    ...secondRowWidgets,
    appStartTable,
    screenLoadTable,
    screenRenderingTable,
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
    ],
  },
};
