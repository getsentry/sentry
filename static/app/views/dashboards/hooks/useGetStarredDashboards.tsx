import {useQuery} from '@tanstack/react-query';

import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useGetStarredDashboards() {
  const organization = useOrganization();
  const {hasProjectAccess, projectsLoaded} = useHasProjectAccess();

  return useQuery({
    ...dashboardsApiOptions(organization, {
      query: {filter: 'onlyFavorites'},
    }),
    staleTime: Infinity,
    enabled: hasProjectAccess || !projectsLoaded,
  });
}
