import {useMemo} from 'react';
import type {QueryClient} from '@tanstack/react-query';

import {defined} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {
  PREBUILT_DASHBOARDS,
  PrebuiltDashboardId,
  type PrebuiltDashboard,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export const useGetPrebuiltDashboard = (prebuiltId?: PrebuiltDashboardId) => {
  const prebuiltDashboard = prebuiltId ? PREBUILT_DASHBOARDS[prebuiltId] : undefined;
  return usePopulatePrebuiltIdsWithActualIds(prebuiltDashboard, prebuiltId);
};

/**
 * Async resolver for use outside of React render (e.g., in duplication callbacks).
 * Fetches real dashboard IDs for any linked dashboards that use placeholder '-1' IDs,
 * then returns the dashboard with those placeholders replaced.
 */
export async function resolveLinkedDashboardIds({
  queryClient,
  orgSlug,
  dashboard,
}: {
  dashboard: DashboardDetails;
  orgSlug: string;
  queryClient: QueryClient;
}): Promise<DashboardDetails> {
  const prebuiltIds = [
    ...new Set(dashboard.widgets.flatMap(getLinkedDashboardPrebuiltIds)),
  ];

  // If no widgets reference other prebuilt dashboards, there are no placeholder
  // IDs to resolve — skip the API call and return the dashboard as-is.
  if (prebuiltIds.length === 0) {
    return dashboard;
  }

  const queryKey = makeDashboardsQueryKey(orgSlug, prebuiltIds);

  const [resolvedDashboards] = await queryClient.fetchQuery({
    queryKey,
    queryFn: fetchDataQuery<DashboardDetails[]>,
    staleTime: Infinity,
  });

  const resolvedIdMap = buildResolvedIdMap(resolvedDashboards);
  return replacePlaceholderLinkedDashboardIds(dashboard, resolvedIdMap);
}

const usePopulatePrebuiltIdsWithActualIds = (
  dashboard?: PrebuiltDashboard,
  prebuiltId?: PrebuiltDashboardId
) => {
  const organization = useOrganization();

  const widgets = useMemo(() => dashboard?.widgets ?? [], [dashboard]);

  const prebuiltIds = useMemo(
    () => widgets.flatMap(getLinkedDashboardPrebuiltIds),
    [widgets]
  );

  const hasLinkedDashboards = prebuiltIds.length > 0;

  const {data, isLoading} = useApiQuery<DashboardDetails[]>(
    makeDashboardsQueryKey(
      organization.slug,
      [...prebuiltIds, prebuiltId].filter(defined)
    ),
    {
      enabled: hasLinkedDashboards || Boolean(prebuiltId),
      staleTime: Infinity,
      retry: false,
    }
  );

  return useMemo(() => {
    const populatedDashboard = {
      ...dashboard,
      widgets,
      id: data?.find(d => d.prebuiltId === prebuiltId)?.id || undefined,
    };

    if (!hasLinkedDashboards && !prebuiltId) {
      return {dashboard: populatedDashboard, isLoading: false};
    }

    if (!data) {
      return {dashboard: populatedDashboard, isLoading};
    }

    const resolvedIdMap = buildResolvedIdMap(data);
    return {
      dashboard: replacePlaceholderLinkedDashboardIds(populatedDashboard, resolvedIdMap),
      isLoading,
    };
  }, [dashboard, widgets, data, hasLinkedDashboards, isLoading, prebuiltId]);
};

/**
 * Extracts all `staticDashboardId` values from a single widget's linked dashboards.
 */
export function getLinkedDashboardPrebuiltIds(widget: Widget): PrebuiltDashboardId[] {
  return widget.queries
    .flatMap(query => query.linkedDashboards ?? [])
    .filter(defined)
    .map(d => d.staticDashboardId)
    .filter(defined);
}

/**
 * Replaces placeholder `dashboardId: '-1'` values in linked dashboards with real IDs
 * from the provided map. Linked dashboards without a `staticDashboardId` (i.e. those
 * that already have a real ID) are left unchanged.
 */
export function replacePlaceholderLinkedDashboardIds<T extends {widgets: Widget[]}>(
  dashboard: T,
  resolvedIdMap: Map<PrebuiltDashboardId, string>
): T {
  return {
    ...dashboard,
    widgets: dashboard.widgets.map(widget => ({
      ...widget,
      queries: widget.queries.map(query => ({
        ...query,
        linkedDashboards: query.linkedDashboards
          ?.map(linkedDashboard => {
            if (!linkedDashboard.staticDashboardId) {
              return linkedDashboard;
            }
            const dashboardId = resolvedIdMap.get(linkedDashboard.staticDashboardId);
            // Drop linked dashboards whose prebuilt target hasn't been materialized
            // yet — sending the placeholder '-1' to the backend would fail.
            return dashboardId ? {...linkedDashboard, dashboardId} : null;
          })
          .filter(defined),
      })),
    })),
  };
}

function buildResolvedIdMap(
  dashboards: DashboardDetails[]
): Map<PrebuiltDashboardId, string> {
  const map = new Map<PrebuiltDashboardId, string>();
  for (const d of dashboards) {
    if (d.prebuiltId) {
      map.set(d.prebuiltId, d.id);
    }
  }
  return map;
}

function makeDashboardsQueryKey(
  orgSlug: string,
  prebuiltIds: PrebuiltDashboardId[]
): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
    {
      query: {
        prebuiltId: prebuiltIds.sort(),
        filter: 'showHidden',
      },
    },
  ];
}
