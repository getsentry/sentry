import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import DashboardDetail from 'sentry/views/dashboards/detail';
import {DashboardState, type DashboardDetails} from 'sentry/views/dashboards/types';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

import {PREBUILT_DASHBOARDS, type PrebuiltDashboardId} from './utils/prebuiltConfigs';

type PrebuiltDashboardRendererProps = {
  prebuiltId: PrebuiltDashboardId;
};

export function PrebuiltDashboardRenderer({prebuiltId}: PrebuiltDashboardRendererProps) {
  const prebuiltDashboard = PREBUILT_DASHBOARDS[prebuiltId];
  const {dashboard: populatedPrebuiltDashboard, isLoading} =
    useGetPrebuiltDashboard(prebuiltId);

  const {title, filters} = prebuiltDashboard;
  const widgets = populatedPrebuiltDashboard?.widgets ?? prebuiltDashboard.widgets;

  const location = useLocation();
  const router = useRouter();

  const dashboard: DashboardDetails = {
    id: `prebuilt-dashboard-${prebuiltId}`,
    prebuiltId,
    title,
    widgets,
    dateCreated: '',
    filters,
    projects: undefined,
  };

  return (
    <LoadingContainer isLoading={isLoading} showChildrenWhileLoading={false}>
      <DashboardDetail
        dashboard={dashboard}
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
    </LoadingContainer>
  );
}
