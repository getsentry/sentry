import * as qs from 'query-string';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardFilters, GlobalFilter} from 'sentry/views/dashboards/types';
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
    const query = Object.keys(queryParams).length ? `?${qs.stringify(queryParams)}` : '';
    return bare
      ? `dashboard/${prebuiltDashboard.id}/${query}`
      : normalizeUrl(`/organizations/${slug}/dashboard/${prebuiltDashboard.id}/${query}`);
  }

  return '';
}
