import {
  useQueryClient,
  useMutation,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
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
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation<null, RequestError, UpdateGroupSearchViewStarredVariables>({
    ...options,
    mutationFn: ({id, starred}: UpdateGroupSearchViewStarredVariables) =>
      fetchMutation<null>({
        url: `/organizations/${organization.slug}/group-search-views/${id}/starred/`,
        method: 'POST',
        data: {starred},
      }),
    onError: (error, variables, onMutateResult, context) => {
      addErrorMessage(
        variables.starred ? t('Failed to star view') : t('Failed to unstar view')
      );
      options.onError?.(error, variables, onMutateResult, context);
    },
    onSettled: (...args) => {
      queryClient.invalidateQueries({
        queryKey: starredGroupSearchViewsApiOptions({orgSlug: organization.slug})
          .queryKey,
      });
      options.onSettled?.(...args);
    },
  });
};
