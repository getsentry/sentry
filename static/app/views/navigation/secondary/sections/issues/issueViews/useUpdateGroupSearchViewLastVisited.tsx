import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
type UpdateGroupSearchViewLastVisitedVariables = {
  viewId: string;
};

export function useUpdateGroupSearchViewLastVisited() {
  const organization = useOrganization();

  return useMutation<void, RequestError, UpdateGroupSearchViewLastVisitedVariables>({
    mutationFn: ({viewId}: UpdateGroupSearchViewLastVisitedVariables) => {
      return fetchMutation<void>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/group-search-views/$viewId/visit/',
          {
            path: {organizationIdOrSlug: organization.slug, viewId},
          }
        ),
        method: 'POST',
      });
    },
  });
}
