import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export function getQueryKey(organization: Organization): ApiQueryKey {
  const DASHBOARDS_QUERY_KEY = [
    getApiUrl('/organizations/$organizationIdOrSlug/dashboards/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {
      query: {
        filter: 'onlyFavorites',
      },
    },
  ] as const;
  const STARRED_DASHBOARDS_QUERY_KEY = [
    getApiUrl('/organizations/$organizationIdOrSlug/dashboards/starred/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {},
  ] as const;
  return organization.features.includes('dashboards-starred-reordering')
    ? STARRED_DASHBOARDS_QUERY_KEY
    : DASHBOARDS_QUERY_KEY;
}

export function useGetStarredDashboards() {
  const organization = useOrganization();
  return useApiQuery<DashboardListItem[]>(getQueryKey(organization), {
    staleTime: Infinity,
  });
}
