import {useCallback} from 'react';

import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {getQueryKey} from 'sentry/views/dashboards/hooks/useGetStarredDashboards';

export function useInvalidateStarredDashboards() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({queryKey: getQueryKey(organization)});
  }, [queryClient, organization]);
}
