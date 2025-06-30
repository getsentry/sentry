import {useCallback} from 'react';

import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useInvalidateStarredDashboards() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [
        `/organizations/${organization.slug}/dashboards/`,
        {query: {filter: 'onlyFavorites'}},
      ],
    });
  }, [queryClient, organization.slug]);
}
