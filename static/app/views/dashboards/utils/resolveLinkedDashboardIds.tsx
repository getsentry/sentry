import {useMemo} from 'react';
import type {QueryClient} from '@tanstack/react-query';

import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

type DashboardInput = {
  prebuiltId?: PrebuiltDashboardId;
  widgets?: Widget[];
};

/**
 * Hook that resolves placeholder linkedDashboard IDs in a dashboard's widgets
 * by reactively fetching real dashboard IDs via useApiQuery.
 *
 * When the dashboard has a `prebuiltId`, the dashboard's own real `id` is also
 * resolved from the API response.
 *
 * @see {@link resolveLinkedDashboardIds} for the imperative equivalent
 * (used in callbacks / event handlers).
 */
export function useResolveLinkedDashboardIds<T extends DashboardInput>(
  dashboard?: T
): {dashboard: (T & {id?: string}) | undefined; isLoading: boolean} {
  const organization = useOrganization();

  const prebuiltIds = useMemo(
    () => getLinkedPrebuiltIds({widgets: dashboard?.widgets}),
    [dashboard]
  );

  const prebuiltId = dashboard?.prebuiltId;
  const allPrebuiltIds = useMemo(
    () => [...prebuiltIds, ...(prebuiltId ? [prebuiltId] : [])].filter(defined),
    [prebuiltIds, prebuiltId]
  );

  const shouldFetch = allPrebuiltIds.length > 0;

  const {data, isLoading} = useApiQuery<DashboardDetails[]>(
    makeLinkedDashboardsQueryKey(organization.slug, allPrebuiltIds),
    {
      enabled: shouldFetch,
      staleTime: Infinity,
      retry: false,
    }
  );

  return useMemo(() => {
    if (!shouldFetch) {
      return {dashboard, isLoading: false};
    }

    if (!data) {
      return {dashboard, isLoading};
    }

    return {
      dashboard: resolveIds(dashboard!, data),
      isLoading,
    };
  }, [dashboard, data, shouldFetch, isLoading]);
}

/**
 * Imperatively resolves placeholder linkedDashboard IDs (e.g. '-1') in a
 * dashboard's widgets by fetching real dashboard IDs from the TanStack Query
 * cache (or API if not cached) using staticDashboardId.
 *
 * When the dashboard has a `prebuiltId`, the dashboard's own real `id` is also
 * resolved from the API response.
 *
 * @see {@link useResolveLinkedDashboardIds} for the reactive hook equivalent
 * (used in render).
 */
export async function resolveLinkedDashboardIds<T extends DashboardInput>(
  queryClient: QueryClient,
  orgSlug: string,
  dashboard: T
): Promise<T & {id?: string}> {
  const prebuiltIds = [
    ...getLinkedPrebuiltIds(dashboard),
    ...(dashboard.prebuiltId ? [dashboard.prebuiltId] : []),
  ].filter(defined);

  if (prebuiltIds.length === 0) {
    return dashboard;
  }

  const [dashboards] = await queryClient.fetchQuery({
    queryKey: makeLinkedDashboardsQueryKey(orgSlug, prebuiltIds),
    queryFn: fetchDataQuery<DashboardDetails[]>,
    staleTime: Infinity,
  });

  return resolveIds(dashboard, dashboards);
}

/**
 * Replaces placeholder linkedDashboard IDs in widgets and, if the dashboard
 * has a `prebuiltId`, resolves the dashboard's own real `id`.
 */
function resolveIds<T extends DashboardInput>(
  dashboard: T,
  fetchedDashboards: DashboardDetails[]
): T & {id?: string} {
  const realId = dashboard.prebuiltId
    ? fetchedDashboards.find(d => d.prebuiltId === dashboard.prebuiltId)?.id
    : undefined;

  const resolved = {
    ...dashboard,
    ...(realId ? {id: realId} : {}),
  };

  if (!dashboard.widgets) {
    return resolved;
  }

  return {
    ...resolved,
    widgets: dashboard.widgets.map(widget => ({
      ...widget,
      queries: widget.queries.map(query => ({
        ...query,
        linkedDashboards: query.linkedDashboards?.map(ld => {
          if (!ld.staticDashboardId) {
            return ld;
          }
          const linkedId = fetchedDashboards.find(
            d => d.prebuiltId === ld.staticDashboardId
          )?.id;
          return linkedId ? {...ld, dashboardId: linkedId} : ld;
        }),
      })),
    })),
  };
}

/**
 * Extracts all unique staticDashboardId values from a dashboard's widget
 * queries' linkedDashboards.
 */
function getLinkedPrebuiltIds(dashboard: DashboardInput): PrebuiltDashboardId[] {
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
  prebuiltIds: PrebuiltDashboardId[]
) {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
    {
      query: {
        prebuiltId: [...prebuiltIds].sort(),
      },
    },
  ] as const;
}
