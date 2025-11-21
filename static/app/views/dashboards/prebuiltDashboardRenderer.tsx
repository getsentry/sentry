import {useMemo} from 'react';

import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
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
  const organization = useOrganization();

  const prebuiltIds = useMemo(
    () =>
      widgets
        .flatMap(widget => {
          return widget.queries
            .flatMap(query => query.linkedDashboards ?? [])
            .filter(defined);
        })
        .map(d => d.staticDashboardId)
        .filter(defined),
    [widgets]
  );

  const hasLinkedDashboards = prebuiltIds.length > 0;
  const path = `/organizations/${organization.slug}/dashboards/`;

  const {data, isLoading} = useApiQuery<DashboardDetails[]>(
    [
      path,
      {
        query: {prebuiltId: prebuiltIds.sort()},
      },
    ],
    {
      enabled: hasLinkedDashboards,
      staleTime: 0,
      retry: false,
    }
  );

  return useMemo(() => {
    if (!hasLinkedDashboards || !data) {
      return {dashboard, isLoading: false};
    }

    const populatedDashboard = {
      ...dashboard,
      widgets: widgets.map(widget => ({
        ...widget,
        queries: widget.queries.map(query => ({
          ...query,
          linkedDashboards: query.linkedDashboards?.map(linkedDashboard => {
            if (!linkedDashboard.staticDashboardId) {
              return linkedDashboard;
            }
            const dashboardId = data.find(
              d => d.prebuiltId === linkedDashboard.staticDashboardId
            )?.id;
            return dashboardId ? {...linkedDashboard, dashboardId} : linkedDashboard;
          }),
        })),
      })),
    };

    return {dashboard: populatedDashboard, isLoading};
  }, [dashboard, widgets, data, hasLinkedDashboards, isLoading]);
};
