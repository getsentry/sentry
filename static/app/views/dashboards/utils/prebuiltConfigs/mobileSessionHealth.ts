import {t} from 'sentry/locale';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {spaceWidgetsEquallyOnRow} from 'sentry/views/dashboards/utils/prebuiltConfigs/utils/spaceWidgetsEquallyOnRow';

const FIRST_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'crash-free-sessions',
      title: t('Crash Free Sessions'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          fields: ['crash_free_rate(session)'],
          aggregates: ['crash_free_rate(session)'],
          columns: [],
          name: '',
          orderby: '',
          conditions: '',
        },
      ],
    },
    {
      id: 'crash-free-users',
      title: t('Crash Free Users'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          fields: ['crash_free_rate(user)'],
          aggregates: ['crash_free_rate(user)'],
          columns: [],
          name: '',
          orderby: '',
          conditions: '',
        },
      ],
    },
    {
      id: 'anr-rate',
      title: t('ANR / App Hang Rate'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          fields: ['anr_rate()'],
          aggregates: ['anr_rate()'],
          columns: [],
          name: '',
          orderby: '',
          conditions: '',
        },
      ],
    },
  ],
  0,
  {h: 1, minH: 1}
);

const SECOND_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'crash-free-session-line-chart',
      title: t('Crash Free Sessions'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          aggregates: ['crash_free_rate(session)'],
          columns: [],
          fields: ['crash_free_rate(session)'],
          name: '',
          orderby: '',
          conditions: '',
        },
      ],
    },
    {
      id: 'crash-free-user-line-chart',
      title: t('Crash Free Users'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          fields: ['crash_free_rate(user)'],
          aggregates: ['crash_free_rate(user)'],
          columns: [],
          name: '',
          orderby: '',
          conditions: '',
        },
      ],
    },
  ],
  1
);

const THIRD_ROW_WIDGETS = spaceWidgetsEquallyOnRow(
  [
    {
      id: 'issue-counts',
      title: t('Issue Counts'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.ISSUE,
      interval: '5m',
      queries: [
        {
          fields: ['count(new_issues)', 'count(resolved_issues)'],
          aggregates: ['count(new_issues)', 'count(resolved_issues)'],
          columns: [],
          name: '',
          orderby: '',
          conditions: '',
        },
      ],
    },
    {
      id: 'total-sessions',
      title: t('Total Sessions'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          fields: ['sum(session)'],
          aggregates: ['sum(session)'],
          columns: [],
          name: '',
          orderby: '',
          conditions: '',
        },
      ],
    },
  ],
  4
);

const CRASH_RATE_TABLE: Widget = {
  id: 'crash-rate-table',
  title: t('Crash Free Rate By Project'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.RELEASE,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: '',
      fields: ['project', 'crash_free_rate(session)'],
      aggregates: ['crash_free_rate(session)'],
      columns: ['project'],
      orderby: 'crash_free_rate(session)',
      fieldAliases: [t('Project'), t('Crash Free Rate')],
    },
  ],
  layout: {x: 0, y: 6, w: 6, h: 2, minH: 2},
};

const RELEASE_TABLE: Widget = {
  id: 'release-table',
  title: t('Releases'),
  displayType: DisplayType.TABLE,
  widgetType: WidgetType.RELEASE,
  interval: '5m',
  queries: [
    {
      name: '',
      conditions: '',
      fields: ['project', 'release', 'crash_free_rate(session)', 'sum(session)'],
      aggregates: ['crash_free_rate(session)', 'sum(session)'],
      columns: ['project', 'release'],
      orderby: '-release',
      fieldAliases: [
        t('Project'),
        t('Release'),
        t('Crash Free Rate'),
        t('Total Sessions'),
      ],
    },
  ],
  layout: {x: 0, y: 8, w: 6, h: 3, minH: 2},
};

export const MOBILE_SESSION_HEALTH_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  filters: {},
  projects: [],
  title: t('Mobile Session Health'),
  widgets: [
    ...FIRST_ROW_WIDGETS,
    ...SECOND_ROW_WIDGETS,
    ...THIRD_ROW_WIDGETS,
    CRASH_RATE_TABLE,
    RELEASE_TABLE,
  ],
};
