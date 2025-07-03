import type {Organization} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

function getQueryKey(organization: Organization): ApiQueryKey {
  const DASHBOARDS_QUERY_KEY = [
    `/organizations/${organization.slug}/dashboards/`,
    {
      query: {
        filter: 'onlyFavorites',
      },
    },
  ] as const;
  const STARRED_DASHBOARDS_QUERY_KEY = [
    `/organizations/${organization.slug}/dashboards/starred/`,
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
