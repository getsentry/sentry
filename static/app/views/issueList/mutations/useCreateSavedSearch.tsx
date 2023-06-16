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

type CreateSavedSearchVariables = {
  name: string;
  orgSlug: string;
  query: string;
  sort: string | null;
  type: SavedSearchType;
  visibility: SavedSearchVisibility;
};

type CreateSavedSearchResponse = SavedSearch;

export const useCreateSavedSearch = (
  options: Omit<
    UseMutationOptions<
      CreateSavedSearchResponse,
      RequestError,
      CreateSavedSearchVariables
    >,
    'mutationFn'
  > = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<CreateSavedSearchResponse, RequestError, CreateSavedSearchVariables>(
    {
      ...options,
      mutationFn: ({orgSlug, ...data}: CreateSavedSearchVariables) =>
        api.requestPromise(`/organizations/${orgSlug}/searches/`, {
          method: 'POST',
          data,
        }),
      onSuccess: (savedSearch, parameters, context) => {
        setApiQueryData(
          queryClient,
          makeFetchSavedSearchesForOrgQueryKey({orgSlug: parameters.orgSlug}),
          oldData => {
            if (!Array.isArray(oldData)) {
              return oldData;
            }

            return [savedSearch, ...oldData];
          }
        );
        options.onSuccess?.(savedSearch, parameters, context);
      },
    }
  );
};
