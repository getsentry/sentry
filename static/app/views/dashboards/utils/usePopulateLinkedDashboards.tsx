import {useMemo} from 'react';

import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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
  return usePopulatePrebuiltIdsWithActualIds(prebuiltDashboard, prebuiltId);
};

const usePopulatePrebuiltIdsWithActualIds = (
  dashboard?: PrebuiltDashboard,
  prebuiltId?: PrebuiltDashboardId
) => {
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

  const {data, isLoading} = useApiQuery<DashboardDetails[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {prebuiltId: [...prebuiltIds.sort(), prebuiltId].filter(defined)},
      },
    ],
    {
      enabled: hasLinkedDashboards || Boolean(prebuiltId),
      staleTime: Infinity,
      retry: false,
    }
  );

  return useMemo(() => {
    const populatedDashboard = {
      ...dashboard,
      id: data?.find(d => d.prebuiltId === prebuiltId)?.id || undefined,
    };

    if (!hasLinkedDashboards && !prebuiltId) {
      return {dashboard: populatedDashboard, isLoading: false};
    }

    if (!data) {
      return {dashboard: populatedDashboard, isLoading};
    }

    const populatedDashboardWithLinkedDashboards = {
      ...populatedDashboard,
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

    return {dashboard: populatedDashboardWithLinkedDashboards, isLoading};
  }, [dashboard, widgets, data, hasLinkedDashboards, isLoading, prebuiltId]);
};
