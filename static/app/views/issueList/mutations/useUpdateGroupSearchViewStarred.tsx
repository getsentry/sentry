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
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import type {GroupSearchView, StarredGroupSearchView} from 'sentry/views/issueList/types';

type UpdateGroupSearchViewStarredVariables = {
  id: string | number;
  starred: boolean;
  view: GroupSearchView;
};

export const useUpdateGroupSearchViewStarred = (
  options: Omit<
    UseMutationOptions<null, RequestError, UpdateGroupSearchViewStarredVariables>,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation<null, RequestError, UpdateGroupSearchViewStarredVariables>({
    ...options,
    mutationFn: ({id, starred}: UpdateGroupSearchViewStarredVariables) =>
      api.requestPromise(
        `/organizations/${organization.slug}/group-search-views/${id}/starred/`,
        {
          method: 'POST',
          data: {starred},
        }
      ),
    onMutate: variables => {
      // Optimistically update the starred views cache, which is displayed in the left nav
      if (variables.starred) {
        setApiQueryData<StarredGroupSearchView[]>(
          queryClient,
          makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
          oldStarredViews => [...(oldStarredViews ?? []), variables.view]
        );
      } else {
        setApiQueryData<StarredGroupSearchView[]>(
          queryClient,
          makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
          oldStarredViews => oldStarredViews?.filter(view => view.id !== variables.id)
        );
      }
      options.onMutate?.(variables);
    },
    onError: (error, variables, context) => {
      addErrorMessage(
        variables.starred ? t('Failed to star view') : t('Failed to unstar view')
      );
      // If we starred it and it failed, remove it from the cache
      // Don't handle the case where it failed to unstar it, because we do not know the
      // correct location to place it back in. The cache invalidation will refetch anyway.
      if (variables.starred) {
        setApiQueryData<StarredGroupSearchView[]>(
          queryClient,
          makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
          data => data?.filter(view => view.id !== variables.id)
        );
      }
      options.onError?.(error, variables, context);
    },
    onSettled: (...args) => {
      queryClient.invalidateQueries({
        queryKey: makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
      });
      options.onSettled?.(...args);
    },
  });
};
