import {t} from 'sentry/locale';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboard} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export const SESSION_HEALTH_PREBUILT_CONFIG: PrebuiltDashboard = {
  dateCreated: '',
  filters: {},
  projects: [],
  title: 'Frontend Session Health',
  widgets: [
    {
      id: 'issue-counts',
      title: t('Issue Counts'),
      displayType: DisplayType.BAR,
      widgetType: WidgetType.ISSUE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count(new_issues)', 'count(resolved_issues)'],
          aggregates: ['count(new_issues)', 'count(resolved_issues)'],
          columns: [],
          orderby: '',
        },
      ],
      layout: {x: 0, y: 0, w: 3, h: 2, minH: 2},
    },
    {
      id: 'issues',
      title: t('Issues'),
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.ISSUE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['issue', 'project', 'title'],
          aggregates: [],
          columns: ['issue', 'project', 'title'],
          orderby: '',
        },
      ],
      layout: {x: 3, y: 0, w: 3, h: 2, minH: 2},
    },
    {
      id: 'unhealthy-sessions',
      title: t('Unhealthy Sessions'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['unhealthy_rate(session)'],
          aggregates: ['unhealthy_rate(session)'],
          columns: [],
          orderby: '',
        },
      ],
      layout: {x: 0, y: 2, w: 3, h: 3, minH: 2},
    },
    {
      id: 'user-health',
      title: t('User Health'),
      displayType: DisplayType.AREA,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: [
            'abnormal_rate(user)',
            'crash_rate(user)',
            'errored_rate(user)',
            'unhandled_rate(user)',
          ],
          aggregates: [
            'abnormal_rate(user)',
            'crash_rate(user)',
            'errored_rate(user)',
            'unhandled_rate(user)',
          ],
          columns: [],
          orderby: '',
        },
      ],
      layout: {x: 3, y: 2, w: 3, h: 3, minH: 2},
    },
    {
      id: 'session-health',
      title: t('Session Health'),
      displayType: DisplayType.AREA,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: [
            'abnormal_rate(session)',
            'crash_rate(session)',
            'errored_rate(session)',
            'unhandled_rate(session)',
          ],
          aggregates: [
            'abnormal_rate(session)',
            'crash_rate(session)',
            'errored_rate(session)',
            'unhandled_rate(session)',
          ],
          columns: [],
          orderby: '',
        },
      ],
      layout: {x: 0, y: 5, w: 2, h: 3, minH: 2},
    },
    {
      id: 'session-counts',
      title: t('Session Counts'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['session.status', 'sum(session)'],
          aggregates: ['sum(session)'],
          columns: ['session.status'],
          orderby: '',
        },
      ],
      layout: {x: 2, y: 5, w: 2, h: 3, minH: 2},
    },
    {
      id: 'user-counts',
      title: t('User Counts'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['session.status', 'count_unique(user)'],
          aggregates: ['count_unique(user)'],
          columns: ['session.status'],
          orderby: '',
        },
      ],
      layout: {x: 4, y: 5, w: 2, h: 3, minH: 2},
    },
  ],
};
