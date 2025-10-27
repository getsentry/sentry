import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import DashboardDetail from 'sentry/views/dashboards/detail';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DashboardState} from 'sentry/views/dashboards/types';
import {
  PREBUILT_DASHBOARDS,
  PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

const RELEASE_HEALTH_WIDGETS: Widget[] =
  PREBUILT_DASHBOARDS[PrebuiltDashboardId.FRONTEND_SESSION_HEALTH].widgets;

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
