import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {QueryParamValue} from 'sentry/utils/useLocation';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

const MAX_STARRED_DASHBOARDS_IN_NAV = 20;

export function starredDashboardsApiOptions(organization: Organization) {
  return apiOptions.as<DashboardListItem[]>()(
    '/organizations/$organizationIdOrSlug/dashboards/starred/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: MAX_STARRED_DASHBOARDS_IN_NAV},
      staleTime: Infinity,
    }
  );
}

export function dashboardsApiOptions(
  organization: Organization,
  options?: {
    query?: {
      cursor?: QueryParamValue;
      filter?: string;
      per_page?: number;
      pin?: string;
      query?: QueryParamValue;
      sort?: string;
    };
  }
) {
  const {query} = options ?? {};
  return apiOptions.as<DashboardListItem[]>()(
    '/organizations/$organizationIdOrSlug/dashboards/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
      ...(query ? {query} : {}),
    }
  );
}
