import {useMutation} from '@tanstack/react-query';

import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
type UpdateGroupSearchViewLastVisitedVariables = {
  viewId: string;
};

export function useUpdateGroupSearchViewLastVisited() {
  const api = useApi();
  const organization = useOrganization();

  return useMutation<void, RequestError, UpdateGroupSearchViewLastVisitedVariables>({
    mutationFn: ({viewId}: UpdateGroupSearchViewLastVisitedVariables) => {
      return api.requestPromise(
        `/organizations/${organization.slug}/group-search-views/${viewId}/visit/`,
        {
          method: 'POST',
        }
      );
    },
  });
}
