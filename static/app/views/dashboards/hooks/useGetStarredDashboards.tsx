import {useQuery} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {starredDashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useOrganization} from 'sentry/utils/useOrganization';

export function getStarredDashboardsQueryKey(organization: Organization) {
  return starredDashboardsApiOptions(organization).queryKey;
}

export function useGetStarredDashboards() {
  const organization = useOrganization();
  const {hasProjectAccess, projectsLoaded} = useHasProjectAccess();

  return useQuery({
    ...starredDashboardsApiOptions(organization),
    staleTime: Infinity,
    enabled: hasProjectAccess || !projectsLoaded,
  });
}
