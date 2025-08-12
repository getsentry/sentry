import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {
  setApiQueryData,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchGroupSearchViewKey} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import type {GroupSearchView, StarredGroupSearchView} from 'sentry/views/issueList/types';

type DeleteGroupSearchViewVariables = {
  id: string;
};
export const useDeleteGroupSearchView = (
  options: Omit<
    UseMutationOptions<GroupSearchView, RequestError, DeleteGroupSearchViewVariables>,
    'mutationFn'
  > = {}
) => {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation<GroupSearchView, RequestError, DeleteGroupSearchViewVariables>({
    ...options,
    mutationFn: ({id}: DeleteGroupSearchViewVariables) =>
      api.requestPromise(
        `/organizations/${organization.slug}/group-search-views/${id}/`,
        {
          method: 'DELETE',
        }
      ),
    onSuccess: (data, parameters, context) => {
      // Invalidate the view in cache
      queryClient.invalidateQueries({
        queryKey: makeFetchGroupSearchViewKey({
          orgSlug: organization.slug,
          id: parameters.id,
        }),
      });

      // Update any matching starred views in cache
      setApiQueryData<StarredGroupSearchView[]>(
        queryClient,
        makeFetchStarredGroupSearchViewsKey({orgSlug: organization.slug}),
        oldGroupSearchViews => {
          return oldGroupSearchViews?.filter(view => view.id !== parameters.id) ?? [];
        }
      );
      options.onSuccess?.(data, parameters, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Failed to delete view'));
      options.onError?.(error, variables, context);
    },
  });
};
