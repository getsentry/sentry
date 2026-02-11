import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {SpanFields} from 'sentry/views/insights/types';

const TRANSACTION_OP_CONDITION = `${SpanFields.TRANSACTION_OP}:[ui.load,navigation]`;

const COLD_START_BIG_NUMBER_WIDGET: Widget = {
  id: 'cold-start-big-number',
  title: t('Avg. Cold App Start'),
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
    h: 1,
    x: 0,
    y: 1,
    w: 1,
    minH: 1,
  },
};

const WARM_START_BIG_NUMBER_WIDGET: Widget = {
  id: 'warm-start-big-number',
  title: t('Avg. Warm App Start'),
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
    h: 1,
    x: 1,
    y: 1,
    w: 1,
    minH: 1,
  },
};

const AVG_TTID_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-ttid-big-number',
  title: t('Avg. TTID'),
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
    h: 1,
    x: 2,
    y: 1,
    w: 1,
    minH: 1,
  },
};

const AVG_TTFD_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-ttfd-big-number',
  title: t('Avg. TTFD'),
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
    h: 1,
    x: 3,
    y: 1,
    w: 1,
    minH: 1,
  },
};

const SLOW_FRAME_RATE_WIDGET: Widget = {
  id: 'slow-frame-rate-big-number',
  title: t('Slow Frame Rate'),
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
    h: 1,
    x: 0,
    y: 0,
    w: 2,
    minH: 1,
  },
};

const FROZEN_FRAME_RATE_WIDGET: Widget = {
  id: 'frozen-frame-rate-big-number',
  title: t('Frozen Frame Rate'),
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
    h: 1,
    x: 2,
    y: 0,
    w: 2,
    minH: 1,
  },
};

const AVG_FRAME_DELAY_WIDGET: Widget = {
  id: 'avg-frame-delay-big-number',
  title: t('Avg. Frame Delay'),
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
    h: 1,
    x: 4,
    y: 0,
    w: 2,
    minH: 1,
  },
};

const APP_START_TABLE: Widget = {
  id: 'app-start-table',
  title: t('App Starts'),
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
    h: 3,
    x: 0,
    y: 2,
    w: 6,
    minH: 2,
  },
};

const SCREEN_RENDERING_TABLE: Widget = {
  id: 'screen-rendering-table',
  title: t('Screen Rendering'),
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
        null,
        null,
        null,
        {valueType: 'percentage', valueUnit: null},
        {valueType: 'percentage', valueUnit: null},
        null,
      ],
      conditions: TRANSACTION_OP_CONDITION,
      orderby: `-count(${SpanFields.SPAN_DURATION})`,
      linkedDashboards: [
        {
          field: 'transaction',
          dashboardId: '-1',
          staticDashboardId: 11,
        },
      ],
    },
  ],
  layout: {
    h: 3,
    x: 0,
    y: 8,
    w: 6,
    minH: 2,
  },
};

const SCREEN_LOAD_TABLE: Widget = {
  id: 'screen-load-table',
  title: t('Screen Loads'),
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
    h: 3,
    x: 0,
    y: 5,
    w: 6,
    minH: 2,
  },
};

const FIRST_ROW_WIDGETS: Widget[] = [
  SLOW_FRAME_RATE_WIDGET,
  FROZEN_FRAME_RATE_WIDGET,
  AVG_FRAME_DELAY_WIDGET,
];

const SECOND_ROW_WIDGETS: Widget[] = [
  COLD_START_BIG_NUMBER_WIDGET,
  WARM_START_BIG_NUMBER_WIDGET,
  AVG_TTID_BIG_NUMBER_WIDGET,
  AVG_TTFD_BIG_NUMBER_WIDGET,
];

export const MOBILE_VITALS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: t('Mobile Vitals as a Dashboard'),
  projects: [],
  widgets: [
    ...FIRST_ROW_WIDGETS,
    ...SECOND_ROW_WIDGETS,
    APP_START_TABLE,
    SCREEN_LOAD_TABLE,
    SCREEN_RENDERING_TABLE,
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
