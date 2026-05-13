import {t} from 'sentry/locale';
import {FieldKind} from 'sentry/utils/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  APP_START_TABLE_CONDITION,
  COLD_START_CONDITION,
  SCREEN_LOAD_TABLE_CONDITION,
  SCREEN_RENDERING_CONDITION,
  SCREEN_RENDERING_TABLE_CONDITION,
  TRANSACTION_COUNT,
  TTFD_CONDITION,
  TTID_CONDITION,
  WARM_START_CONDITION,
} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/constants';
import {DASHBOARD_TITLE} from 'sentry/views/dashboards/utils/prebuiltConfigs/mobileVitals/settings';
import {TABLE_MIN_HEIGHT} from 'sentry/views/dashboards/utils/prebuiltConfigs/settings';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const COLD_START_BIG_NUMBER_WIDGET: Widget = {
  id: 'cold-start-big-number',
  title: t('Average Cold App Start'),
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
      fields: [`avg(${SpanFields.APP_VITALS_START_COLD_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_START_COLD_VALUE})`],
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

const WARM_START_BIG_NUMBER_WIDGET: Widget = {
  id: 'warm-start-big-number',
  title: t('Average Warm App Start'),
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
      fields: [`avg(${SpanFields.APP_VITALS_START_WARM_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_START_WARM_VALUE})`],
      columns: [],
      conditions: WARM_START_CONDITION,
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

const AVG_TTID_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-ttid-big-number',
  title: t('Average TTID'),
  description: 'Average time to initial display',
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
    x: 2,
    y: 0,
    w: 1,
    minH: 1,
  },
};

const AVG_TTFD_BIG_NUMBER_WIDGET: Widget = {
  id: 'avg-ttfd-big-number',
  title: t('Average TTFD'),
  description: 'Average time to full display',
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
    x: 3,
    y: 0,
    w: 1,
    minH: 1,
  },
};

// Uses the Sessions (Release) dataset, so most dashboard global filters (which target Spans)
// don't apply. Still valuable as a top-level health signal alongside the span-based vitals.
const CRASH_FREE_SESSION_RATE_BIG_NUMBER_WIDGET: Widget = {
  id: 'crash-free-session-rate-big-number',
  title: t('Crash Free Session Rate'),
  description:
    'Percentage of sessions that did not crash. Based on session data, so span filters do not apply.',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.RELEASE,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: ['crash_free_rate(session)'],
      aggregates: ['crash_free_rate(session)'],
      columns: [],
      conditions: '',
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
  description:
    'Percentage of slow frames across screen load transactions, calculated as total slow frames divided by total frames.',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        `sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT})`,
        `sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT}) / sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
      ],
      aggregates: [
        `sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT})`,
        `sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT}) / sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
      ],
      selectedAggregate: 2,
      columns: [],
      conditions: SCREEN_RENDERING_CONDITION,
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

const FROZEN_FRAME_RATE_WIDGET: Widget = {
  id: 'frozen-frame-rate-big-number',
  title: t('Frozen Frame Rate'),
  description:
    'Percentage of frozen frames across screen load transactions, calculated as total frozen frames divided by total frames.',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        `sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT})`,
        `sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT}) / sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
      ],
      aggregates: [
        `sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT})`,
        `sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT}) / sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
      ],
      selectedAggregate: 2,
      columns: [],
      conditions: SCREEN_RENDERING_CONDITION,
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

const AVG_FRAME_DELAY_WIDGET: Widget = {
  id: 'avg-frame-delay-big-number',
  title: t('Average Frame Delay'),
  description: 'Average frame delay',
  displayType: DisplayType.BIG_NUMBER,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [`avg(${SpanFields.APP_VITALS_FRAMES_DELAY_VALUE})`],
      aggregates: [`avg(${SpanFields.APP_VITALS_FRAMES_DELAY_VALUE})`],
      columns: [],
      conditions: SCREEN_RENDERING_CONDITION,
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

const APP_START_TABLE: Widget = {
  id: 'app-start-table',
  title: t('App Starts'),
  description: t(
    "On iOS, cold and warm start classification may differ from Apple's definitions. Sentry defines a cold start as a launch after first install, reboot, or update; all other launches are warm starts. Warm start results may differ between prewarmed and non-prewarmed launches."
  ),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `avg(${SpanFields.APP_VITALS_START_COLD_VALUE})`,
        `avg(${SpanFields.APP_VITALS_START_WARM_VALUE})`,
        TRANSACTION_COUNT,
      ],
      aggregates: [
        `avg(${SpanFields.APP_VITALS_START_COLD_VALUE})`,
        `avg(${SpanFields.APP_VITALS_START_WARM_VALUE})`,
        TRANSACTION_COUNT,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: [
        t('Screen'),
        t('Avg Cold Start'),
        t('Avg Warm Start'),
        t('Screen Loads'),
      ],
      conditions: APP_START_TABLE_CONDITION,
      orderby: `-${TRANSACTION_COUNT}`,
      linkedDashboards: [
        {
          field: SpanFields.TRANSACTION,
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
    minH: TABLE_MIN_HEIGHT,
  },
};

const SCREEN_RENDERING_TABLE: Widget = {
  id: 'screen-rendering-table',
  title: t('Screen Rendering'),
  description:
    'Frame rates are weighted across screen load transactions using total frame counts.',
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.SPANS,
  interval: '1h',
  thresholds: null,
  queries: [
    {
      name: '',
      fields: [
        SpanFields.TRANSACTION,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        TRANSACTION_COUNT,
      ],
      aggregates: [
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_SLOW_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        `equation|sum(${SpanFields.APP_VITALS_FRAMES_FROZEN_COUNT})/sum(${SpanFields.APP_VITALS_FRAMES_TOTAL_COUNT})`,
        TRANSACTION_COUNT,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: [
        t('Transaction'),
        t('Slow Frame %'),
        t('Frozen Frame %'),
        t('Screen Loads'),
      ],
      conditions: SCREEN_RENDERING_TABLE_CONDITION,
      orderby: `-${TRANSACTION_COUNT}`,
      linkedDashboards: [
        {
          field: SpanFields.TRANSACTION,
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
    minH: TABLE_MIN_HEIGHT,
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
        `avg(${SpanFields.APP_VITALS_TTID_VALUE})`,
        `avg(${SpanFields.APP_VITALS_TTFD_VALUE})`,
        TRANSACTION_COUNT,
      ],
      aggregates: [
        `avg(${SpanFields.APP_VITALS_TTID_VALUE})`,
        `avg(${SpanFields.APP_VITALS_TTFD_VALUE})`,
        TRANSACTION_COUNT,
      ],
      columns: [SpanFields.TRANSACTION],
      fieldAliases: [t('Screen'), t('Avg TTID'), t('Avg TTFD'), t('Screen Loads')],
      conditions: SCREEN_LOAD_TABLE_CONDITION,
      orderby: `-${TRANSACTION_COUNT}`,
      linkedDashboards: [
        {
          field: SpanFields.TRANSACTION,
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
    minH: TABLE_MIN_HEIGHT,
  },
};

const FIRST_ROW_WIDGETS: Widget[] = [
  COLD_START_BIG_NUMBER_WIDGET,
  WARM_START_BIG_NUMBER_WIDGET,
  AVG_TTID_BIG_NUMBER_WIDGET,
  AVG_TTFD_BIG_NUMBER_WIDGET,
];

const SECOND_ROW_WIDGETS: Widget[] = [
  SLOW_FRAME_RATE_WIDGET,
  FROZEN_FRAME_RATE_WIDGET,
  AVG_FRAME_DELAY_WIDGET,
  CRASH_FREE_SESSION_RATE_BIG_NUMBER_WIDGET,
];

export const MOBILE_VITALS_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  title: DASHBOARD_TITLE,
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
  onboarding: {type: 'module', moduleName: ModuleName.MOBILE_VITALS},
};
