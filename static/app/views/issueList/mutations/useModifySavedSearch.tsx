import {SavedSearch, SavedSearchType, SavedSearchVisibility} from 'sentry/types';
import {
  setApiQueryData,
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {makeFetchSavedSearchesForOrgQueryKey} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

type ModifySavedSearchVariables = {
  id: string;
  name: string;
  orgSlug: string;
  query: string;
  sort: string | null;
  type: SavedSearchType;
  visibility: SavedSearchVisibility;
};

type ModifySavedSearchResponse = SavedSearch;

export const useModifySavedSearch = (
  options: Omit<
    UseMutationOptions<
      ModifySavedSearchResponse,
      RequestError,
      ModifySavedSearchVariables
    >,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<ModifySavedSearchResponse, RequestError, ModifySavedSearchVariables>(
    {
      ...options,
      mutationFn: ({id, orgSlug, ...data}: ModifySavedSearchVariables) =>
        api.requestPromise(`/organizations/${orgSlug}/searches/${id}/`, {
          method: 'PUT',
          data,
        }),
      onSuccess: (savedSearch, parameters, context) => {
        setApiQueryData<SavedSearch[]>(
          queryClient,
          makeFetchSavedSearchesForOrgQueryKey({orgSlug: parameters.orgSlug}),
          oldData => {
            if (!Array.isArray(oldData)) {
              return oldData;
            }

            return oldData.map(search =>
              search?.id === parameters.id ? savedSearch : search
            );
          }
        );
        options.onSuccess?.(savedSearch, parameters, context);
      },
    }
  );
};
