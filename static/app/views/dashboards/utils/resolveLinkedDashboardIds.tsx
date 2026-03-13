import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

/**
 * Hook that resolves placeholder linkedDashboard IDs in a dashboard's widgets
 * by reactively fetching real dashboard IDs via useApiQuery.
 *
 * If the dashboard has a `prebuiltId`, widget config is looked up from
 * `PREBUILT_DASHBOARDS` automatically — callers should pass the server record
 * as-is without pre-merging the frontend config.
 *
 * @see {@link resolveLinkedDashboardIds} for the pure function equivalent
 * (used in callbacks / event handlers after fetching dashboards yourself).
 */
export function useResolveLinkedDashboardIds(dashboard?: DashboardDetails): {
  dashboard: DashboardDetails | undefined;
  isLoading: boolean;
} {
  const organization = useOrganization();

  const prebuiltIds = useMemo(() => getLinkedPrebuiltIds(dashboard), [dashboard]);

  const shouldFetch = prebuiltIds.length > 0;

  const {data, isLoading} = useApiQuery<DashboardDetails[]>(
    makeLinkedDashboardsQueryKey(organization.slug, prebuiltIds),
    {
      enabled: shouldFetch,
      staleTime: Infinity,
      retry: false,
    }
  );

  if (!shouldFetch) {
    return {dashboard: withEffectiveWidgets(dashboard), isLoading: false};
  }

  if (!data) {
    return {dashboard: withEffectiveWidgets(dashboard), isLoading};
  }

  return {
    dashboard: resolveLinkedDashboardIds(dashboard!, data),
    isLoading,
  };
}

/**
 * Replaces placeholder linkedDashboard IDs (e.g. '-1') in a dashboard's widgets
 * with real database IDs looked up from `fetchedDashboards`.
 *
 * If the dashboard has a `prebuiltId`, widget config is looked up from
 * `PREBUILT_DASHBOARDS` automatically.
 *
 * This is a pure data transformation — the caller is responsible for fetching
 * the dashboards (e.g. via queryClient.fetchQuery or useApiQuery).
 *
 * @see {@link useResolveLinkedDashboardIds} for the reactive hook equivalent.
 */
export function resolveLinkedDashboardIds(
  dashboard: DashboardDetails,
  fetchedDashboards: DashboardDetails[]
): DashboardDetails {
  const widgets = getEffectiveWidgets(dashboard);

  return {
    ...dashboard,
    widgets: widgets.map(widget => ({
      ...widget,
      queries: widget.queries.map(query => ({
        ...query,
        linkedDashboards: query.linkedDashboards
          ?.map(ld => {
            if (!ld.staticDashboardId) {
              return ld;
            }
            const linkedId = fetchedDashboards.find(
              d => d.prebuiltId === ld.staticDashboardId
            )?.id;
            if (!linkedId) {
              Sentry.captureMessage('Failed to resolve linked dashboard prebuilt ID', {
                extra: {staticDashboardId: ld.staticDashboardId},
              });
              return null;
            }
            return {...ld, dashboardId: linkedId};
          })
          .filter(defined),
      })),
    })),
  };
}

/**
 * Extracts all unique staticDashboardId values from a dashboard's widget
 * queries' linkedDashboards.
 *
 * Uses {@link getEffectiveWidgets} so it works on server records that have
 * a `prebuiltId` but no widgets.
 */
export function getLinkedPrebuiltIds(
  dashboard?: DashboardDetails
): PrebuiltDashboardId[] {
  return getEffectiveWidgets(dashboard)
    .flatMap(widget =>
      (widget.queries ?? [])
        .flatMap(query => query.linkedDashboards ?? [])
        .filter(defined)
    )
    .map(ld => ld.staticDashboardId)
    .filter(defined);
}

/**
 * Builds a TanStack Query key for fetching dashboards by prebuilt IDs.
 * Matches the query key format used by useApiQuery so cache is shared.
 */
export function makeLinkedDashboardsQueryKey(
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

/**
 * Returns the effective widgets for a dashboard. For prebuilt dashboards,
 * widgets are looked up from the frontend `PREBUILT_DASHBOARDS` config since
 * the server record doesn't store them. For regular dashboards, returns the
 * dashboard's own widgets.
 */
function getEffectiveWidgets(dashboard?: DashboardDetails): Widget[] {
  if (!dashboard) {
    return [];
  }
  if (dashboard.prebuiltId) {
    return PREBUILT_DASHBOARDS[dashboard.prebuiltId]?.widgets ?? dashboard.widgets;
  }
  return dashboard.widgets;
}

/**
 * Returns a copy of the dashboard with effective widgets applied.
 * Useful when no linked-ID resolution is needed but we still want
 * to merge the prebuilt widget config.
 */
function withEffectiveWidgets(
  dashboard?: DashboardDetails
): DashboardDetails | undefined {
  if (!dashboard) {
    return undefined;
  }
  const widgets = getEffectiveWidgets(dashboard);
  return widgets === dashboard.widgets ? dashboard : {...dashboard, widgets};
}
