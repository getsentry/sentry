import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import DashboardDetail from 'sentry/views/dashboards/detail';
import {DashboardState, type DashboardDetails} from 'sentry/views/dashboards/types';

import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboard,
  type PrebuiltDashboardId,
} from './utils/prebuiltConfigs';

type PrebuiltDashboardRendererProps = {
  prebuiltId: PrebuiltDashboardId;
};

export function PrebuiltDashboardRenderer({prebuiltId}: PrebuiltDashboardRendererProps) {
  const prebuiltDashboard = PREBUILT_DASHBOARDS[prebuiltId];
  const {
    dashboard: {title, widgets, filters},
    isLoading,
  } = usePopulateLinkedDashboards(prebuiltDashboard);

  const location = useLocation();
  const router = useRouter();

  const dashboard: DashboardDetails = {
    id: `prebuilt-dashboard-${prebuiltId}`,
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

const usePopulateLinkedDashboards = (dashboard: PrebuiltDashboard) => {
  const {widgets} = dashboard;
  const linkedDashboardsWithStaticDashboardIds = widgets
    .flatMap(widget => {
      return widget.queries
        .flatMap(query => query.linkedDashboards ?? [])
        .filter(defined);
    })
    .filter(linkedDashboard => linkedDashboard.staticDashboardId !== undefined);

  if (!linkedDashboardsWithStaticDashboardIds.length) {
    return {dashboard, isLoading: false};
  }

  // TODO we should fetch the real dashboard id here, this requires BROWSE-128

  return {dashboard, isLoading: false};
};
