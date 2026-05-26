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
import {groupSearchViewApiOptions} from 'sentry/views/issueList/queries/groupSearchView';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type DeleteGroupSearchViewVariables = {
  id: string;
};
export const useDeleteGroupSearchView = (
  options: Omit<
    UseMutationOptions<GroupSearchView, RequestError, DeleteGroupSearchViewVariables>,
    'mutationFn'
  > = {}
) => {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation({
    ...options,
    mutationFn: ({id}: DeleteGroupSearchViewVariables) =>
      fetchMutation<GroupSearchView>({
        url: `/organizations/${organization.slug}/group-search-views/${id}/`,
        method: 'DELETE',
      }),
    onSuccess: (data, parameters, onMutateResult, context) => {
      // Invalidate the view in cache
      queryClient.invalidateQueries(
        groupSearchViewApiOptions({
          orgSlug: organization.slug,
          id: parameters.id,
        })
      );

      // Update any matching starred views in cache
      const starredKey = starredGroupSearchViewsApiOptions({
        orgSlug: organization.slug,
      }).queryKey;
      queryClient.setQueryData(starredKey, prevData =>
        prevData
          ? {
              ...prevData,
              json: prevData.json.filter(view => view.id !== parameters.id),
            }
          : prevData
      );
      options.onSuccess?.(data, parameters, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      addErrorMessage(t('Failed to delete view'));
      options.onError?.(error, variables, onMutateResult, context);
    },
  });
};
