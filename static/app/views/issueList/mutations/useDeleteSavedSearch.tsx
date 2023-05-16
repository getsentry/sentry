import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {SavedSearch} from 'sentry/types';
import {
  getApiQueryData,
  setApiQueryData,
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {makeFetchSavedSearchesForOrgQueryKey} from 'sentry/views/issueList/queries/useFetchSavedSearchesForOrg';

type DeleteSavedSearchVariables = {
  id: string;
  orgSlug: string;
};

type DeleteSavedSearchResponse = unknown;

type DeleteSavedSearchContext = {
  previousSavedSearches?: SavedSearch[];
};

type Options = UseMutationOptions<
  DeleteSavedSearchResponse,
  RequestError,
  DeleteSavedSearchVariables,
  DeleteSavedSearchContext
>;

export const useDeleteSavedSearchOptimistic = (
  incomingOptions: Omit<Options, 'mutationFn'> = {}
) => {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const options: Options = {
    ...incomingOptions,
    mutationFn: ({orgSlug, id}) => {
      return api.requestPromise(`/organizations/${orgSlug}/searches/${id}/`, {
        method: 'DELETE',
      });
    },
    onMutate: async variables => {
      await queryClient.cancelQueries(
        makeFetchSavedSearchesForOrgQueryKey({orgSlug: variables.orgSlug})
      );

      const previousSavedSearches = getApiQueryData<SavedSearch[]>(
        queryClient,
        makeFetchSavedSearchesForOrgQueryKey({orgSlug: variables.orgSlug})
      );

      setApiQueryData(
        queryClient,
        makeFetchSavedSearchesForOrgQueryKey({orgSlug: variables.orgSlug}),
        oldData => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          return oldData.filter(search => search?.id !== variables.id);
        }
      );

      incomingOptions.onMutate?.(variables);

      return {previousSavedSearches};
    },
    onError: (error, variables, context) => {
      addErrorMessage(t('Failed to delete saved search.'));

      if (context) {
        setApiQueryData(
          queryClient,
          makeFetchSavedSearchesForOrgQueryKey({orgSlug: variables.orgSlug}),
          context.previousSavedSearches
        );
      }

      incomingOptions.onError?.(error, variables, context);
    },
  };

  return useMutation(options);
};
