import {useCallback, useMemo} from 'react';
import * as qs from 'query-string';

import {pageFiltersToQueryParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DashboardFilter,
  type DashboardDetails,
  type DashboardFilters,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';
import {hasPlatformizedInsights} from 'sentry/views/insights/common/utils/useHasPlatformizedInsights';

export interface PrebuiltDashboardUrlOptions {
  bare?: boolean;
  /**
   * Dashboard-specific filters (release, global filters) to apply
   * when navigating to a prebuilt dashboard URL.
   * Only applied to dashboard URLs, not module URL fallbacks.
   */
  filters?: DashboardFilters;
}

function applyDashboardFilters(
  queryParams: Record<string, unknown>,
  filters?: DashboardFilters
) {
  if (filters?.release?.length) {
    queryParams.release = filters.release;
  }
  if (filters?.globalFilter?.length) {
    queryParams.globalFilter = filters.globalFilter.map(filter =>
      JSON.stringify({...filter, isTemporary: true} satisfies GlobalFilter)
    );
  }
}

export function usePrebuiltDashboardUrl(
  prebuiltId: PrebuiltDashboardId,
  options: PrebuiltDashboardUrlOptions = {}
): string | undefined {
  const {bare = false, filters} = options;
  const organization = useOrganization({allowNull: true});
  const {selection} = usePageFilters();
  const isPlatformized = organization ? hasPlatformizedInsights(organization) : false;
  const {dashboard: prebuiltDashboard} = useGetPrebuiltDashboard(
    isPlatformized ? prebuiltId : undefined
  );

  const queryParams = pageFiltersToQueryParams(selection);

  if (!organization) {
    return undefined;
  }

  const {slug} = organization;

  if (isPlatformized && prebuiltDashboard.id) {
    applyDashboardFilters(queryParams, filters);
    const query = Object.keys(queryParams).length ? `?${qs.stringify(queryParams)}` : '';
    return bare
      ? `dashboard/${prebuiltDashboard.id}/${query}`
      : normalizeUrl(`/organizations/${slug}/dashboard/${prebuiltDashboard.id}/${query}`);
  }

  return undefined;
}

/**
 * Hook that fetches all requested prebuilt dashboards in a single API call
 * and returns a function to build URLs by prebuilt ID.
 */
export function usePrebuiltDashboardUrlBuilder(
  prebuiltIds: PrebuiltDashboardId[] = [],
  options: PrebuiltDashboardUrlOptions = {}
) {
  const {bare = false, filters} = options;
  const organization = useOrganization({allowNull: true});
  const {selection} = usePageFilters();
  const isPlatformized = organization ? hasPlatformizedInsights(organization) : false;

  const fetchAll = prebuiltIds.length === 0;

  const sortedIds = useMemo(
    () => (isPlatformized && !fetchAll ? [...prebuiltIds].sort((a, b) => a - b) : []),
    [prebuiltIds, isPlatformized, fetchAll]
  );

  const apiQueryParams: Record<string, unknown> = {
    filter: DashboardFilter.SHOW_HIDDEN,
  };
  if (!fetchAll) {
    apiQueryParams.prebuiltId = sortedIds;
  }

  const {data} = useApiQuery<DashboardDetails[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
        path: {organizationIdOrSlug: organization?.slug ?? ''},
      }),
      {query: apiQueryParams},
    ],
    {
      enabled: isPlatformized && (fetchAll || sortedIds.length > 0),
      staleTime: Infinity,
      retry: false,
    }
  );

  const idMap = useMemo(() => {
    const map = new Map<PrebuiltDashboardId, string>();
    if (data) {
      for (const dashboard of data) {
        if (dashboard.prebuiltId) {
          map.set(dashboard.prebuiltId, dashboard.id);
        }
      }
    }
    return map;
  }, [data]);

  const buildUrl = useCallback(
    (prebuiltId: PrebuiltDashboardId): string | undefined => {
      if (!organization || !isPlatformized) {
        return undefined;
      }

      const dashboardId = idMap.get(prebuiltId);
      if (!dashboardId) {
        return undefined;
      }

      const queryParams = pageFiltersToQueryParams(selection);
      applyDashboardFilters(queryParams, filters);
      const query = Object.keys(queryParams).length
        ? `?${qs.stringify(queryParams)}`
        : '';

      return bare
        ? `dashboard/${dashboardId}/${query}`
        : normalizeUrl(
            `/organizations/${organization.slug}/dashboard/${dashboardId}/${query}`
          );
    },
    [organization, isPlatformized, idMap, selection, filters, bare]
  );

  return buildUrl;
}
