import {useMemo} from 'react';
import type {QueryClient} from '@tanstack/react-query';

import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboard,
  type PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export const useGetPrebuiltDashboard = (prebuiltId?: PrebuiltDashboardId) => {
  const prebuiltDashboard = prebuiltId ? PREBUILT_DASHBOARDS[prebuiltId] : undefined;
  return usePopulatePrebuiltIdsWithActualIds(prebuiltDashboard, prebuiltId);
};

/**
 * Resolves placeholder linkedDashboard IDs (e.g. '-1') in prebuilt dashboards
 * by fetching the real dashboard IDs from the TanStack Query cache (or API if
 * not cached) using staticDashboardId.
 */
export async function resolveLinkedDashboardIds(
  queryClient: QueryClient,
  orgSlug: string,
  dashboard: DashboardDetails
): Promise<DashboardDetails> {
  const prebuiltIds = getLinkedPrebuiltIds(dashboard);

  if (prebuiltIds.length === 0) {
    return dashboard;
  }

  const [dashboards] = await queryClient.fetchQuery({
    queryKey: makeLinkedDashboardsQueryKey(orgSlug, prebuiltIds),
    queryFn: fetchDataQuery<DashboardDetails[]>,
    staleTime: Infinity,
  });

  return populateLinkedDashboardIds(dashboard, dashboards);
}

const usePopulatePrebuiltIdsWithActualIds = (
  dashboard?: PrebuiltDashboard,
  prebuiltId?: PrebuiltDashboardId
) => {
  const organization = useOrganization();

  const prebuiltIds = useMemo(
    () => getLinkedPrebuiltIds({widgets: dashboard?.widgets}),
    [dashboard]
  );

  const hasLinkedDashboards = prebuiltIds.length > 0;

  const {data, isLoading} = useApiQuery<DashboardDetails[]>(
    makeLinkedDashboardsQueryKey(organization.slug, prebuiltIds, prebuiltId),
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

    return {
      dashboard: populateLinkedDashboardIds(populatedDashboard, data),
      isLoading,
    };
  }, [dashboard, data, hasLinkedDashboards, isLoading, prebuiltId]);
};

/**
 * Extracts all unique staticDashboardId values from a dashboard's widget
 * queries' linkedDashboards.
 */
function getLinkedPrebuiltIds(dashboard: {widgets?: Widget[]}): PrebuiltDashboardId[] {
  return (dashboard.widgets ?? [])
    .flatMap(widget =>
      widget.queries.flatMap(query => query.linkedDashboards ?? []).filter(defined)
    )
    .map(ld => ld.staticDashboardId)
    .filter(defined);
}

/**
 * Builds a TanStack Query key for fetching dashboards by prebuilt IDs.
 * Matches the query key format used by useApiQuery so cache is shared.
 */
function makeLinkedDashboardsQueryKey(
  orgSlug: string,
  prebuiltIds: PrebuiltDashboardId[],
  selfPrebuiltId?: PrebuiltDashboardId
) {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
    {
      query: {
        prebuiltId: [
          ...prebuiltIds.sort(),
          ...(selfPrebuiltId ? [selfPrebuiltId] : []),
        ].filter(defined),
      },
    },
  ] as const;
}

/**
 * Maps linkedDashboards' staticDashboardId to real dashboardId using
 * fetched dashboard data.
 */
function populateLinkedDashboardIds<T extends {widgets?: Widget[]}>(
  dashboard: T,
  fetchedDashboards: DashboardDetails[]
): T {
  if (!dashboard.widgets) {
    return dashboard;
  }

  return {
    ...dashboard,
    widgets: dashboard.widgets.map(widget => ({
      ...widget,
      queries: widget.queries.map(query => ({
        ...query,
        linkedDashboards: query.linkedDashboards?.map(ld => {
          if (!ld.staticDashboardId) {
            return ld;
          }
          const realId = fetchedDashboards.find(
            d => d.prebuiltId === ld.staticDashboardId
          )?.id;
          return realId ? {...ld, dashboardId: realId} : ld;
        }),
      })),
    })),
  };
}
