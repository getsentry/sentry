import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {
  dashboardsApiOptions,
  starredDashboardsApiOptions,
} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getStarredDashboardsQueryKey(organization: Organization) {
  if (organization.features.includes('dashboards-starred-reordering')) {
    return starredDashboardsApiOptions(organization).queryKey;
  }
  return dashboardsApiOptions(organization, {
    query: {filter: 'onlyFavorites'},
  }).queryKey;
}

export function useGetStarredDashboards() {
  const organization = useOrganization();
  const {hasProjectAccess, projectsLoaded} = useHasProjectAccess();

  const usesStarredEndpoint = organization.features.includes(
    'dashboards-starred-reordering'
  );

  return useQuery({
    ...(usesStarredEndpoint
      ? starredDashboardsApiOptions(organization)
      : dashboardsApiOptions(organization, {
          query: {filter: 'onlyFavorites'},
        })),
    staleTime: Infinity,
    enabled: hasProjectAccess || !projectsLoaded,
  });
}
