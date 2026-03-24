import {useMemo} from 'react';
import * as qs from 'query-string';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  DashboardDetails,
  DashboardFilters,
  GlobalFilter,
} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';
import {hasPlatformizedInsights} from 'sentry/views/insights/common/utils/useHasPlatformizedInsights';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {
  useDomainViewFilters,
  type DomainView,
} from 'sentry/views/insights/pages/useFilters';
import {getModuleView} from 'sentry/views/insights/pages/utils';
import {ModuleName} from 'sentry/views/insights/types';

/**
 * Maps PrebuiltDashboardId to its corresponding ModuleName for fallback
 * when platformized insights is disabled.
 */
const PREBUILT_DASHBOARD_MODULE_NAMES: Partial<
  Record<PrebuiltDashboardId, ModuleName>
> = {
  [PrebuiltDashboardId.BACKEND_QUERIES]: ModuleName.DB,
  [PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY]: ModuleName.DB,
  [PrebuiltDashboardId.HTTP]: ModuleName.HTTP,
  [PrebuiltDashboardId.HTTP_DOMAIN_SUMMARY]: ModuleName.HTTP,
  [PrebuiltDashboardId.BACKEND_CACHES]: ModuleName.CACHE,
  [PrebuiltDashboardId.BACKEND_QUEUES]: ModuleName.QUEUE,
  [PrebuiltDashboardId.BACKEND_QUEUE_SUMMARY]: ModuleName.QUEUE,
  [PrebuiltDashboardId.WEB_VITALS]: ModuleName.VITAL,
  [PrebuiltDashboardId.WEB_VITALS_SUMMARY]: ModuleName.VITAL,
  [PrebuiltDashboardId.FRONTEND_ASSETS]: ModuleName.RESOURCE,
  [PrebuiltDashboardId.FRONTEND_ASSETS_SUMMARY]: ModuleName.RESOURCE,
  [PrebuiltDashboardId.MOBILE_VITALS_SCREEN_LOADS]: ModuleName.SCREEN_LOAD,
  [PrebuiltDashboardId.MOBILE_VITALS_APP_STARTS]: ModuleName.APP_START,
  [PrebuiltDashboardId.MOBILE_VITALS]: ModuleName.MOBILE_VITALS,
  [PrebuiltDashboardId.MOBILE_VITALS_SCREEN_RENDERING]: ModuleName.SCREEN_RENDERING,
  [PrebuiltDashboardId.AI_AGENTS_MODELS]: ModuleName.AGENT_MODELS,
  [PrebuiltDashboardId.AI_AGENTS_TOOLS]: ModuleName.AGENT_TOOLS,
  [PrebuiltDashboardId.MCP_TOOLS]: ModuleName.MCP_TOOLS,
  [PrebuiltDashboardId.MCP_RESOURCES]: ModuleName.MCP_RESOURCES,
  [PrebuiltDashboardId.MCP_PROMPTS]: ModuleName.MCP_PROMPTS,
  [PrebuiltDashboardId.FRONTEND_SESSION_HEALTH]: ModuleName.SESSIONS,
};

export interface PrebuiltDashboardUrlOptions {
  bare?: boolean;
  /**
   * Dashboard-specific filters (release, global filters) to apply
   * when navigating to a prebuilt dashboard URL.
   * Only applied to dashboard URLs, not module URL fallbacks.
   */
  filters?: DashboardFilters;
}

/**
 * Fetches the actual dashboard IDs for all prebuilt dashboards.
 * Returns a map from PrebuiltDashboardId to actual dashboard ID string.
 */
function usePrebuiltDashboardIds(enabled: boolean) {
  const organization = useOrganization({allowNull: true});

  const allPrebuiltIds = useMemo(
    () =>
      Object.values(PrebuiltDashboardId)
        .filter((v): v is number => typeof v === 'number')
        .sort((a, b) => a - b),
    []
  );

  const {data} = useApiQuery<DashboardDetails[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
        path: {organizationIdOrSlug: organization?.slug ?? ''},
      }),
      {
        query: {prebuiltId: allPrebuiltIds, filter: 'showHidden'},
      },
    ],
    {
      enabled: enabled && Boolean(organization),
      staleTime: Infinity,
      retry: false,
    }
  );

  return useMemo(() => {
    if (!data) {
      return undefined;
    }
    const map = new Map<PrebuiltDashboardId, string>();
    for (const dashboard of data) {
      if (dashboard.prebuiltId !== undefined && dashboard.id) {
        map.set(dashboard.prebuiltId, dashboard.id);
      }
    }
    return map;
  }, [data]);
}

function extractQueryParamsFromPageFilters(pageFilters: PageFilters) {
  const queryParams: Record<string, string | string[] | number[]> = {};
  if (pageFilters?.projects?.length) {
    queryParams.project = pageFilters.projects;
  }
  if (pageFilters?.environments?.length) {
    queryParams.environment = pageFilters.environments;
  }
  if (pageFilters?.datetime?.period) {
    queryParams.statsPeriod = pageFilters.datetime.period;
  }
  if (pageFilters?.datetime?.start) {
    queryParams.start = pageFilters.datetime.start?.toString() ?? undefined;
  }
  if (pageFilters?.datetime?.end) {
    queryParams.end = pageFilters.datetime.end?.toString() ?? undefined;
  }
  return queryParams;
}

function applyDashboardFilters(
  queryParams: Record<string, string | string[] | number[]>,
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
): string {
  const {bare = false, filters} = options;
  const organization = useOrganization({allowNull: true});
  const {selection} = usePageFilters();
  const isPlatformized = organization ? hasPlatformizedInsights(organization) : false;
  const {dashboard: prebuiltDashboard} = useGetPrebuiltDashboard(prebuiltId);

  const queryParams = extractQueryParamsFromPageFilters(selection);

  if (!organization) {
    return '';
  }

  const {slug} = organization;

  if (isPlatformized && prebuiltDashboard.id) {
    applyDashboardFilters(queryParams, filters);
    const query = Object.keys(queryParams).length
      ? `?${qs.stringify(queryParams)}`
      : '';
    return bare
      ? `dashboard/${prebuiltDashboard.id}/${query}`
      : normalizeUrl(
          `/organizations/${slug}/dashboard/${prebuiltDashboard.id}/${query}`
        );
  }

  return '';
}

export type PrebuiltDashboardURLBuilder = (
  prebuiltId: PrebuiltDashboardId,
) => string;

/**
 * Returns a function that builds URLs for prebuilt dashboards when platformized
 * insights is enabled. Does not handle module URL fallbacks.
 */
export function usePrebuiltDashboardUrlBuilder(
  options: PrebuiltDashboardUrlOptions = {}
): PrebuiltDashboardURLBuilder {
  const {bare = false, filters} = options;
  const organization = useOrganization({allowNull: true});
  const isPlatformized = organization ? hasPlatformizedInsights(organization) : false;
  const prebuiltDashboardIds = usePrebuiltDashboardIds(isPlatformized);
  const {selection} = usePageFilters();

  const queryParams = extractQueryParamsFromPageFilters(selection);

  if (!organization) {
    return () => '';
  }

  const {slug} = organization;

  return function (prebuiltId: PrebuiltDashboardId) {
    if (isPlatformized && prebuiltDashboardIds) {
      const dashboardId = prebuiltDashboardIds.get(prebuiltId);
      if (dashboardId) {
        applyDashboardFilters(queryParams, filters);
        const query = Object.keys(queryParams).length
          ? `?${qs.stringify(queryParams)}`
          : '';
        return bare
          ? `dashboard/${dashboardId}/${query}`
          : normalizeUrl(
              `/organizations/${slug}/dashboard/${dashboardId}/${query}`
            );
      }
    }

    return '';
  };
}

export type PrebuiltDashboardOrModuleURLBuilder = (
  prebuiltId: PrebuiltDashboardId,
  view?: DomainView,
  fallbackSuffix?: string
) => string;

/**
 * Returns a function that builds URLs for prebuilt dashboards when platformized
 * insights is enabled, or falls back to the corresponding insights module URL otherwise.
 *
 * The optional `fallbackSuffix` parameter is appended to the module URL in the
 * non-platformized fallback case (e.g., '/domains' or '/spans/span/abc123').
 * When platformized, the suffix is ignored and the dashboard URL is returned directly.
 */
export function usePrebuiltDashboardUrlOrModuleUrlBuilder(
  options: PrebuiltDashboardUrlOptions = {}
): PrebuiltDashboardOrModuleURLBuilder {
  const {bare = false} = options;
  const organization = useOrganization({allowNull: true});
  const {view: currentView} = useDomainViewFilters();
  const dashboardUrlBuilder = usePrebuiltDashboardUrlBuilder(options);

  if (!organization) {
    return () => '';
  }

  const {slug} = organization;

  return function (
    prebuiltId: PrebuiltDashboardId,
    view?: DomainView,
    fallbackSuffix?: string
  ) {
    const dashboardUrl = dashboardUrlBuilder(prebuiltId);
    if (dashboardUrl) {
      return dashboardUrl;
    }

    // Fallback to module URL — fallbackSuffix is only applied here
    const moduleName = PREBUILT_DASHBOARD_MODULE_NAMES[prebuiltId];
    if (!moduleName) {
      return '';
    }

    let resolvedView = view ?? currentView;
    if (!resolvedView) {
      resolvedView = getModuleView(moduleName);
    }

    const moduleBaseUrl = MODULE_BASE_URLS[moduleName];
    const suffix = fallbackSuffix ?? '';

    return bare
      ? `${DOMAIN_VIEW_BASE_URL}/${resolvedView}/${moduleBaseUrl}${suffix}`
      : normalizeUrl(
          `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${resolvedView}/${moduleBaseUrl}${suffix}`
        );
  };
}
