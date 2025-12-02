import {useMemo} from 'react';

import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardDetails} from 'sentry/views/dashboards/types';
import {
  PREBUILT_DASHBOARDS,
  PrebuiltDashboardId,
  type PrebuiltDashboard,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export const useGetPrebuiltDashboard = (prebuiltId?: PrebuiltDashboardId) => {
  const prebuiltDashboard = prebuiltId ? PREBUILT_DASHBOARDS[prebuiltId] : undefined;
  return usePopulateLinkedDashboards(prebuiltDashboard);
};

const usePopulateLinkedDashboards = (dashboard?: PrebuiltDashboard) => {
  const organization = useOrganization();

  const widgets = useMemo(() => dashboard?.widgets ?? [], [dashboard]);

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
    if (!hasLinkedDashboards) {
      return {dashboard, isLoading: false};
    }

    if (!data) {
      return {dashboard, isLoading};
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
