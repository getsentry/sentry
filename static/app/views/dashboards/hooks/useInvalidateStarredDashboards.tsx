import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useInvalidateStarredDashboards() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries(
      dashboardsApiOptions(organization, {query: {filter: 'onlyFavorites'}})
    );
  }, [queryClient, organization]);
}
