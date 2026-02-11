import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

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
    onError: (error, variables, context) => {
      addErrorMessage(
        variables.starred ? t('Failed to star view') : t('Failed to unstar view')
      );
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
