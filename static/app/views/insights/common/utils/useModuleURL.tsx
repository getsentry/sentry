import {useMemo} from 'react';
import * as qs from 'query-string';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardDetails, DashboardFilters} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {BASE_URL as AGENT_MODELS_BASE_URL} from 'sentry/views/insights/agentModels/settings';
import {BASE_URL as AGENT_TOOLS_BASE_URL} from 'sentry/views/insights/agentTools/settings';
import {BASE_URL as RESOURCES_BASE_URL} from 'sentry/views/insights/browser/resources/settings';
import {BASE_URL as VITALS_BASE_URL} from 'sentry/views/insights/browser/webVitals/settings';
import {BASE_URL as CACHE_BASE_URL} from 'sentry/views/insights/cache/settings';
import {hasPlatformizedInsights} from 'sentry/views/insights/common/utils/useHasPlatformizedInsights';
import {BASE_URL as DB_BASE_URL} from 'sentry/views/insights/database/settings';
import {BASE_URL as HTTP_BASE_URL} from 'sentry/views/insights/http/settings';
import {BASE_URL as MCP_PROMPTS_BASE_URL} from 'sentry/views/insights/mcp-prompts/settings';
import {BASE_URL as MCP_RESOURCES_BASE_URL} from 'sentry/views/insights/mcp-resources/settings';
import {BASE_URL as MCP_TOOLS_BASE_URL} from 'sentry/views/insights/mcp-tools/settings';
import {BASE_URL as APP_STARTS_BASE_URL} from 'sentry/views/insights/mobile/appStarts/settings';
import {BASE_URL as SCREEN_LOADS_BASE_URL} from 'sentry/views/insights/mobile/screenload/settings';
import {BASE_URL as SCREEN_RENDERING_BASE_URL} from 'sentry/views/insights/mobile/screenRendering/settings';
import {BASE_URL as MOBILE_SCREENS_BASE_URL} from 'sentry/views/insights/mobile/screens/settings';
import {BASE_URL as MOBILE_UI_BASE_URL} from 'sentry/views/insights/mobile/ui/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {
  useDomainViewFilters,
  type DomainView,
} from 'sentry/views/insights/pages/useFilters';
import {getModuleView} from 'sentry/views/insights/pages/utils';
import {BASE_URL as QUEUE_BASE_URL} from 'sentry/views/insights/queues/settings';
import {BASE_URL as SESSIONS_BASE_URL} from 'sentry/views/insights/sessions/settings';
import {ModuleName} from 'sentry/views/insights/types';

export const MODULE_BASE_URLS: Record<ModuleName, string> = {
  [ModuleName.DB]: DB_BASE_URL,
  [ModuleName.HTTP]: HTTP_BASE_URL,
  [ModuleName.CACHE]: CACHE_BASE_URL,
  [ModuleName.QUEUE]: QUEUE_BASE_URL,
  [ModuleName.SCREEN_LOAD]: SCREEN_LOADS_BASE_URL,
  [ModuleName.APP_START]: APP_STARTS_BASE_URL,
  [ModuleName.VITAL]: VITALS_BASE_URL,
  [ModuleName.RESOURCE]: RESOURCES_BASE_URL,
  [ModuleName.AGENT_MODELS]: AGENT_MODELS_BASE_URL,
  [ModuleName.AGENT_TOOLS]: AGENT_TOOLS_BASE_URL,
  [ModuleName.MCP_TOOLS]: MCP_TOOLS_BASE_URL,
  [ModuleName.MCP_RESOURCES]: MCP_RESOURCES_BASE_URL,
  [ModuleName.MCP_PROMPTS]: MCP_PROMPTS_BASE_URL,
  [ModuleName.MOBILE_UI]: MOBILE_UI_BASE_URL,
  [ModuleName.MOBILE_VITALS]: MOBILE_SCREENS_BASE_URL,
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_BASE_URL,
  [ModuleName.SESSIONS]: SESSIONS_BASE_URL,
  [ModuleName.OTHER]: '',
};

type ModuleNameStrings = `${ModuleName}`;
export type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

/**
 * Maps PrebuiltDashboardId to its corresponding ModuleName for fallback
 * when platformized insights is disabled. Not all prebuilt dashboards
 * have a corresponding module (e.g., overview and summary dashboards).
 */
const PREBUILT_DASHBOARD_MODULE_NAMES: Partial<Record<PrebuiltDashboardId, ModuleName>> =
  {
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

export const useModuleURL = (
  moduleName: RoutableModuleNames,
  bare = false,
  view?: DomainView // Todo - this should be required when a module belongs to multiple views
): string => {
  const builder = useModuleURLBuilder(bare);
  return builder(moduleName, view);
};

export type URLBuilder = (
  moduleName: RoutableModuleNames,
  domainView?: DomainView
) => string;

/**
 *  This hook returns a function to build URLs for the module summary pages.
 *  It falls back to the insights URL while dashboard IDs are loading or if
 *  no prebuilt dashboard exists for the module.
 *
 *  This function will return the domain specific module url, the domain is determined in the following order of priority:
 *    1. The domain view passed in by the user
 *    2. (when detectDomainView=true) The current domain view (i.e if the current url is `/performance/frontend`, the current view is frontned)
 *    3. The default view for the module
 */
export function useModuleURLBuilder(bare = false, detectDomainView = true): URLBuilder {
  const organization = useOrganization({allowNull: true}); // Some parts of the app, like the main sidebar, render even if the organization isn't available (during loading, or at all).
  const {view: currentView} = useDomainViewFilters();

  if (!organization) {
    // If there isn't an organization, items that link to modules won't be visible, so this is a fallback just-in-case, and isn't trying too hard to be useful
    return () => '';
  }

  const {slug} = organization;

  return function (moduleName: RoutableModuleNames, domainView?: DomainView) {
    let view = detectDomainView ? currentView : (currentView ?? domainView);

    if (!view) {
      view = getModuleView(moduleName as ModuleName);
    }

    return bare
      ? `${DOMAIN_VIEW_BASE_URL}/${view}/${MODULE_BASE_URLS[moduleName]}`
      : normalizeUrl(
          `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${view}/${MODULE_BASE_URLS[moduleName]}`
        );
  };
}

interface PrebuiltDashboardUrlOptions {
  bare?: boolean;
  /**
   * Dashboard-specific filters (release, global filters) to apply
   * when navigating to a prebuilt dashboard URL.
   * Only applied to dashboard URLs, not module URL fallbacks.
   */
  filters?: DashboardFilters;
  /**
   * Page filters (project, environment, date range) to append as
   * query parameters when navigating to a prebuilt dashboard URL.
   * Only applied to dashboard URLs, not module URL fallbacks.
   */
  pageFilters?: {
    end?: string;
    environment?: string[];
    project?: number[];
    start?: string;
    statsPeriod?: string;
  };
  view?: DomainView;
}

/**
 * Returns the URL for a prebuilt dashboard when platformized insights is enabled,
 * or falls back to the corresponding insights module URL otherwise.
 *
 * For navigation elements that should always go to the insights page (e.g.,
 * domain view tabs, sidebar links), use `useModuleURL` directly instead.
 */
export function usePrebuiltDashboardUrlOrModuleUrl(
  prebuiltId: PrebuiltDashboardId,
  options: PrebuiltDashboardUrlOptions = {}
): string {
  const {bare = false, filters, pageFilters, view} = options;
  const organization = useOrganization({allowNull: true});
  const {view: currentView} = useDomainViewFilters();
  const isPlatformized = organization ? hasPlatformizedInsights(organization) : false;
  const prebuiltDashboardIds = usePrebuiltDashboardIds(isPlatformized);

  if (!organization) {
    return '';
  }

  const {slug} = organization;

  if (isPlatformized && prebuiltDashboardIds) {
    const dashboardId = prebuiltDashboardIds.get(prebuiltId);
    if (dashboardId) {
      const queryParams: Record<string, string | string[] | number[]> = {};
      if (pageFilters?.project?.length) {
        queryParams.project = pageFilters.project;
      }
      if (pageFilters?.environment?.length) {
        queryParams.environment = pageFilters.environment;
      }
      if (pageFilters?.statsPeriod) {
        queryParams.statsPeriod = pageFilters.statsPeriod;
      }
      if (pageFilters?.start) {
        queryParams.start = pageFilters.start;
      }
      if (pageFilters?.end) {
        queryParams.end = pageFilters.end;
      }
      if (filters?.release?.length) {
        queryParams.release = filters.release;
      }
      const query = Object.keys(queryParams).length
        ? `?${qs.stringify(queryParams)}`
        : '';
      return bare
        ? `dashboard/${dashboardId}/${query}`
        : normalizeUrl(`/organizations/${slug}/dashboard/${dashboardId}/${query}`);
    }
  }

  // Fallback to module URL
  const moduleName = PREBUILT_DASHBOARD_MODULE_NAMES[prebuiltId];
  if (!moduleName) {
    return '';
  }

  let resolvedView = view ?? currentView;

  if (!resolvedView) {
    resolvedView = getModuleView(moduleName);
  }

  const moduleBaseUrl = MODULE_BASE_URLS[moduleName];

  return bare
    ? `${DOMAIN_VIEW_BASE_URL}/${resolvedView}/${moduleBaseUrl}`
    : normalizeUrl(
        `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${resolvedView}/${moduleBaseUrl}`
      );
}

export type PrebuiltDashboardURLBuilder = (
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
): PrebuiltDashboardURLBuilder {
  const {bare = false, filters, pageFilters} = options;
  const organization = useOrganization({allowNull: true});
  const {view: currentView} = useDomainViewFilters();
  const isPlatformized = organization ? hasPlatformizedInsights(organization) : false;
  const prebuiltDashboardIds = usePrebuiltDashboardIds(isPlatformized);

  if (!organization) {
    return () => '';
  }

  const {slug} = organization;

  return function (
    prebuiltId: PrebuiltDashboardId,
    view?: DomainView,
    fallbackSuffix?: string
  ) {
    // Dashboard URLs are always /dashboard/:id/ with no sub-routes.
    // fallbackSuffix is intentionally NOT applied here.
    if (isPlatformized && prebuiltDashboardIds) {
      const dashboardId = prebuiltDashboardIds.get(prebuiltId);
      if (dashboardId) {
        const queryParams: Record<string, string | string[] | number[]> = {};
        if (pageFilters?.project?.length) {
          queryParams.project = pageFilters.project;
        }
        if (pageFilters?.environment?.length) {
          queryParams.environment = pageFilters.environment;
        }
        if (pageFilters?.statsPeriod) {
          queryParams.statsPeriod = pageFilters.statsPeriod;
        }
        if (pageFilters?.start) {
          queryParams.start = pageFilters.start;
        }
        if (pageFilters?.end) {
          queryParams.end = pageFilters.end;
        }
        if (filters?.release?.length) {
          queryParams.release = filters.release;
        }
        const query = Object.keys(queryParams).length
          ? `?${qs.stringify(queryParams)}`
          : '';
        return bare
          ? `dashboard/${dashboardId}/${query}`
          : normalizeUrl(`/organizations/${slug}/dashboard/${dashboardId}/${query}`);
      }
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
