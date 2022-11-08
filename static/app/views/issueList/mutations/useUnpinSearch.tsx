import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {SavedSearch, SavedSearchType, SavedSearchVisibility} from 'sentry/types';
import {useMutation, UseMutationOptions, useQueryClient} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {makeFetchSavedSearchesForOrgQueryKey} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

type UnpinSavedSearchVariables = {
  orgSlug: string;
  type: SavedSearchType;
};

type UnpinSavedSearchResponse = {type: SavedSearchType};

export const useUnpinSearch = (
  options: Omit<
    UseMutationOptions<UnpinSavedSearchResponse, RequestError, UnpinSavedSearchVariables>,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<UnpinSavedSearchResponse, RequestError, UnpinSavedSearchVariables>({
    ...options,
    mutationFn: ({orgSlug, type}) =>
      api.requestPromise(`/organizations/${orgSlug}/pinned-searches/`, {
        method: 'DELETE',
        data: {
          type,
        },
      }),
    onSuccess: (savedSearch, variables, context) => {
      queryClient.setQueryData<SavedSearch[]>(
        makeFetchSavedSearchesForOrgQueryKey({orgSlug: variables.orgSlug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(
            search => search.visibility === SavedSearchVisibility.OwnerPinned
          );
        }
      );
      options.onSuccess?.(savedSearch, variables, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Failed to unpin search.'));
      options.onError?.(error, variables, context);
    },
  });
};
