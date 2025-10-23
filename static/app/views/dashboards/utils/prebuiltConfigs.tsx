import {t} from 'sentry/locale';
import {
  DisplayType,
  WidgetType,
  type DashboardDetails,
} from 'sentry/views/dashboards/types';

export enum PrebuiltDashboardId {
  FRONTEND_SESSION_HEALTH = 1,
}

export const PREBUILT_DASHBOARDS: Record<
  PrebuiltDashboardId,
  Omit<DashboardDetails, 'id'>
> = {
  [PrebuiltDashboardId.FRONTEND_SESSION_HEALTH]: {
    dateCreated: '',
    filters: {},
    projects: [],
    title: 'Frontend Session Health',
    widgets: [
      {
        id: 'unhealthy-sessions',
        title: t('Unhealthy Sessions'),
        displayType: DisplayType.LINE,
        widgetType: WidgetType.RELEASE,
        interval: '',
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
        layout: {x: 0, y: 0, w: 3, h: 3, minH: 2},
      },
      {
        id: 'user-health',
        title: t('User Health'),
        displayType: DisplayType.AREA,
        widgetType: WidgetType.RELEASE,
        interval: '',
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
        layout: {x: 3, y: 0, w: 3, h: 3, minH: 2},
      },
      {
        id: 'session-health',
        title: t('Session Health'),
        displayType: DisplayType.AREA,
        widgetType: WidgetType.RELEASE,
        interval: '',
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
        layout: {x: 0, y: 3, w: 2, h: 3, minH: 2},
      },
      {
        id: 'session-counts',
        title: t('Session Counts'),
        displayType: DisplayType.LINE,
        widgetType: WidgetType.RELEASE,
        interval: '',
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
        layout: {x: 2, y: 3, w: 2, h: 3, minH: 2},
      },
      {
        id: 'user-counts',
        title: t('User Counts'),
        displayType: DisplayType.LINE,
        widgetType: WidgetType.RELEASE,
        interval: '4h',
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
        layout: {x: 4, y: 3, w: 2, h: 3, minH: 2},
      },
    ],
  },
};
