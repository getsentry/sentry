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
  orgSlug: string;
  views: GroupSearchView[];
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
    mutationFn: ({orgSlug, views: data}: UpdateGroupSearchViewsVariables) =>
      api.requestPromise(`/organizations/${orgSlug}/group-search-views/`, {
        method: 'PUT',
        data,
      }),
    onSuccess: (views, parameters, context) => {
      setApiQueryData<View[]>(
        queryClient,
        makeFetchGroupSearchViewsKey({orgSlug: parameters.orgSlug}),
        views // Update the cache with the new views
      );
      options.onSuccess?.(views, parameters, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Failed to update views'));
      options.onError?.(error, variables, context);
    },
  });
};
