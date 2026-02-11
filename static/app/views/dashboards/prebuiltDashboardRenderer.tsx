import LoadingContainer from 'sentry/components/loading/loadingContainer';
import DashboardDetail from 'sentry/views/dashboards/detail';
import {
  DashboardState,
  type DashboardDetails,
  type DashboardFilters,
} from 'sentry/views/dashboards/types';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

import {PREBUILT_DASHBOARDS, type PrebuiltDashboardId} from './utils/prebuiltConfigs';

type PrebuiltDashboardRendererProps = {
  prebuiltId: PrebuiltDashboardId;
  additionalFilters?: DashboardFilters;
};

export function PrebuiltDashboardRenderer({
  prebuiltId,
  additionalFilters,
}: PrebuiltDashboardRendererProps) {
  const prebuiltDashboard = PREBUILT_DASHBOARDS[prebuiltId];
  const {dashboard: populatedPrebuiltDashboard, isLoading} =
    useGetPrebuiltDashboard(prebuiltId);

  const {title, filters} = prebuiltDashboard;
  const widgets = populatedPrebuiltDashboard?.widgets ?? prebuiltDashboard.widgets;

  const mergedFilters: DashboardFilters = {
    ...filters,
    ...additionalFilters,
  };

  if (additionalFilters?.globalFilter) {
    const baseFilters = filters?.globalFilter ?? [];
    const overrideKeys = new Set(additionalFilters.globalFilter.map(f => f.tag.key));
    mergedFilters.globalFilter = [
      ...baseFilters.filter(f => !overrideKeys.has(f.tag.key)),
      ...additionalFilters.globalFilter,
    ];
  }

  const dashboard: DashboardDetails = {
    id: `prebuilt-dashboard-${prebuiltId}`,
    prebuiltId,
    title,
    widgets,
    dateCreated: '',
    filters: mergedFilters,
    projects: undefined,
  };

  return (
    <LoadingContainer isLoading={isLoading} showChildrenWhileLoading={false}>
      <DashboardDetail
        dashboard={dashboard}
        dashboards={[]}
        initialState={DashboardState.EMBEDDED}
        useTimeseriesVisualization
      />
    </LoadingContainer>
  );
}
