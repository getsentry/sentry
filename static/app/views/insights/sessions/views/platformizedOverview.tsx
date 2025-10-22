import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import DashboardDetail from 'sentry/views/dashboards/detail';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DashboardState, DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

const RELEASE_HEALTH_WIDGETS: Widget[] = [
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
        fields: ['unhealthy_rate(session)', 'sum(session)'],
        aggregates: ['unhealthy_rate(session)', 'sum(session)'],
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
];

const DASHBOARD: DashboardDetails = {
  id: 'session-health-overview',
  title: t('Session Health'),
  widgets: RELEASE_HEALTH_WIDGETS,
  dateCreated: '',
  filters: {},
  projects: undefined,
};

export function PlatformizedSessionsOverview() {
  const location = useLocation();
  const router = useRouter();

  return (
    <ModulePageProviders moduleName="sessions">
      <DashboardDetail
        dashboard={DASHBOARD}
        location={location}
        params={{
          dashboardId: undefined,
          templateId: undefined,
          widgetId: undefined,
          widgetIndex: undefined,
        }}
        route={{}}
        routeParams={{}}
        router={router}
        routes={[]}
        dashboards={[]}
        initialState={DashboardState.EMBEDDED}
        useTimeseriesVisualization
      />
    </ModulePageProviders>
  );
}
