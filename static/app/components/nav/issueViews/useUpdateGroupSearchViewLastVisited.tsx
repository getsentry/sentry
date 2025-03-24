import {useMutation, type UseMutationOptions} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type UpdateGroupSearchViewLastVisitedVariables = {
  viewId: string;
};

export function useUpdateGroupSearchViewLastVisited(
  options: Omit<
    UseMutationOptions<void, RequestError, UpdateGroupSearchViewLastVisitedVariables>,
    'mutationFn'
  > = {}
) {
  const api = useApi();
  const organization = useOrganization();

  return useMutation<void, RequestError, UpdateGroupSearchViewLastVisitedVariables>({
    ...options,
    mutationFn: ({viewId}: UpdateGroupSearchViewLastVisitedVariables) => {
      return api.requestPromise(
        `/organizations/${organization.slug}/group-search-views/${viewId}/visit/`,
        {
          method: 'POST',
        }
      );
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
    },
  });
}
