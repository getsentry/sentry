import LoadingContainer from 'sentry/components/loading/loadingContainer';
import DashboardDetail from 'sentry/views/dashboards/detail';
import {
  DashboardState,
  type DashboardDetails,
  type DashboardFilters,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

import {PREBUILT_DASHBOARDS, type PrebuiltDashboardId} from './utils/prebuiltConfigs';

type PrebuiltDashboardRendererProps = {
  prebuiltId: PrebuiltDashboardId;
  additionalGlobalFilters?: GlobalFilter[];
};

export function PrebuiltDashboardRenderer({
  prebuiltId,
  additionalGlobalFilters,
}: PrebuiltDashboardRendererProps) {
  const prebuiltDashboard = PREBUILT_DASHBOARDS[prebuiltId];
  const {dashboard: populatedPrebuiltDashboard, isLoading} =
    useGetPrebuiltDashboard(prebuiltId);

  const {title, filters} = prebuiltDashboard;
  const widgets = populatedPrebuiltDashboard?.widgets ?? prebuiltDashboard.widgets;

  // Merge the dashboard's built-in filters with any additional global filters.
  // Overrides replace matching filters in-place (by tag key + dataset) to preserve order.
  // Filters with no match in the base list are appended at the end.
  const mergedFilters: DashboardFilters = {...filters};

  if (additionalGlobalFilters) {
    const filterKey = (f: GlobalFilter) => `${f.tag.key}:${f.dataset}`;
    const overridesByKey = new Map(additionalGlobalFilters.map(f => [filterKey(f), f]));
    const usedKeys = new Set<string>();

    const baseFilters = filters?.globalFilter ?? [];
    mergedFilters.globalFilter = baseFilters.map(f => {
      const override = overridesByKey.get(filterKey(f));
      if (override) {
        usedKeys.add(filterKey(f));
        return override;
      }
      return f;
    });

    // Append any additional filters that didn't match a base filter
    for (const f of additionalGlobalFilters) {
      if (!usedKeys.has(filterKey(f))) {
        mergedFilters.globalFilter.push(f);
      }
    }
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
