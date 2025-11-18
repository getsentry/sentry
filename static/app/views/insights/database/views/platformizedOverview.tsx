import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import DashboardDetail from 'sentry/views/dashboards/detail';
import type {DashboardDetails} from 'sentry/views/dashboards/types';
import {DashboardState} from 'sentry/views/dashboards/types';
import {
  PREBUILT_DASHBOARDS,
  PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

const DASHBOARD_CONFIG = PREBUILT_DASHBOARDS[PrebuiltDashboardId.BACKEND_QUERIES];

const FILTERS = DASHBOARD_CONFIG.filters;
const WIDGETS = DASHBOARD_CONFIG.widgets;

const DASHBOARD: DashboardDetails = {
  id: 'queries-overview',
  title: t('Backend Queries'),
  widgets: WIDGETS,
  dateCreated: '',
  filters: FILTERS,
  projects: undefined,
};

export function PlatformizedQueriesOverview() {
  const location = useLocation();
  const router = useRouter();

  return (
    <ModulePageProviders moduleName="db">
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
