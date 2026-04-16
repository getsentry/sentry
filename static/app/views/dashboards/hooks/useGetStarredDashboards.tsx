import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export function getStarredDashboardsQueryKey(organization: Organization) {
  if (organization.features.includes('dashboards-starred-reordering')) {
    return apiOptions.as<DashboardListItem[]>()(
      '/organizations/$organizationIdOrSlug/dashboards/starred/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: Infinity,
      }
    ).queryKey;
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
      ? apiOptions.as<DashboardListItem[]>()(
          '/organizations/$organizationIdOrSlug/dashboards/starred/',
          {
            path: {organizationIdOrSlug: organization.slug},
            staleTime: Infinity,
          }
        )
      : dashboardsApiOptions(organization, {
          query: {filter: 'onlyFavorites'},
        })),
    staleTime: Infinity,
    enabled: hasProjectAccess || !projectsLoaded,
  });
}
