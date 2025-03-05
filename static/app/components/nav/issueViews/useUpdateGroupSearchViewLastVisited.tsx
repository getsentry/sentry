import {useMutation, type UseMutationOptions} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type UpdateGroupSearchViewLastVisitedVariables = {
  viewId: string;
};

/**
 * Hook to update the last visited timestamp for a group search view.
 * This sends a PUT request to the organization/{org-slug}/group-search-view/visit/:viewId endpoint.
 *
 * @returns A mutation object that can be used to update the last visited timestamp for a group search view.
 *
 * @example
 * ```tsx
 * const {mutate} = useUpdateGroupSearchViewLastVisited();
 *
 * // Later in your code
 * mutate({viewId: '123'});
 * ```
 */
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
        `/organizations/${organization.slug}/group-search-view/visit/${viewId}/`,
        {
          method: 'PUT',
        }
      );
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context);
    },
  });
}
