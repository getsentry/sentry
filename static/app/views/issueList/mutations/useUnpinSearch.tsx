import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {SavedSearch, SavedSearchType} from 'sentry/types/group';
import type {UseMutationOptions} from 'sentry/utils/queryClient';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
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
      setApiQueryData<SavedSearch[]>(
        queryClient,
        makeFetchSavedSearchesForOrgQueryKey({orgSlug: variables.orgSlug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(search => !search.isPinned);
        }
      );
      addSuccessMessage(t("You'll no longer see this search by default."));
      options.onSuccess?.(savedSearch, variables, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Unable to remove the default search.'));
      options.onError?.(error, variables, context);
    },
  });
};
