import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {
  setApiQueryData,
  useMutation,
  type UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {makeFetchGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type UpdateGroupSearchViewsVariables = {
  groupSearchViews: GroupSearchView[];
  orgSlug: string;
};

// The PUT groupsearchviews endpoint updates the views AND returns the updated views
type UpdateGroupSearchViewResponse = GroupSearchView[];

export const useUpdateGroupSearchViews = (
  options: Omit<
    UseMutationOptions<
      UpdateGroupSearchViewResponse,
      RequestError,
      UpdateGroupSearchViewsVariables
    >,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<
    UpdateGroupSearchViewResponse,
    RequestError,
    UpdateGroupSearchViewsVariables
  >({
    ...options,
    mutationFn: ({orgSlug, groupSearchViews: data}: UpdateGroupSearchViewsVariables) =>
      api.requestPromise(`/organizations/${orgSlug}/group-search-views/`, {
        method: 'PUT',
        data,
      }),
    onSuccess: (groupSearchViews, parameters, context) => {
      setApiQueryData<GroupSearchView[]>(
        queryClient,
        makeFetchGroupSearchViewsKey({orgSlug: parameters.orgSlug}),
        groupSearchViews // Update the cache with the new groupSearchViews
      );
      options.onSuccess?.(groupSearchViews, parameters, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Failed to update views'));
      options.onError?.(error, variables, context);
    },
  });
};
