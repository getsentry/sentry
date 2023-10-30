import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {SavedSearch, SavedSearchType} from 'sentry/types';
import {
  setApiQueryData,
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {makeFetchSavedSearchesForOrgQueryKey} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

type PinSavedSearchVariables = {
  orgSlug: string;
  query: string;
  sort: string | null;
  type: SavedSearchType;
};

type PinSavedSearchResponse = SavedSearch;

export const usePinSearch = (
  options: Omit<
    UseMutationOptions<PinSavedSearchResponse, RequestError, PinSavedSearchVariables>,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<PinSavedSearchResponse, RequestError, PinSavedSearchVariables>({
    ...options,
    mutationFn: ({orgSlug, query, type, sort}) =>
      api.requestPromise(`/organizations/${orgSlug}/pinned-searches/`, {
        method: 'PUT',
        data: {query, type, sort},
      }),
    onSuccess: (savedSearch, variables, context) => {
      setApiQueryData<SavedSearch[]>(
        queryClient,
        makeFetchSavedSearchesForOrgQueryKey({orgSlug: variables.orgSlug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return [
            savedSearch,
            // Make sure we remove any existing pinned searches
            ...oldData.filter(search => !search.isPinned),
          ];
        }
      );
      addSuccessMessage(t('When you come back you’ll see this search by default.'));
      options.onSuccess?.(savedSearch, variables, context);
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Unable to set the default search.'));
      options.onError?.(error, variables, context);
    },
  });
};
