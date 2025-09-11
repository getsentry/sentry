import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {
  fetchDataQuery,
  fetchMutation,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

// currently set the polling interval to 2000 ms
export const POLLING_INTERVAL = 2000;
export const PAGE_SIZE = 20;

type SyncReposResponse = {
  isSyncing: boolean;
};

type QueryKey = [url: string];

export function useSyncRepos({searchValue}: {searchValue?: string}) {
  const organization = useOrganization();
  const orgSlug = organization.slug;
  const {integratedOrgId} = usePreventContext();
  const queryClient = useQueryClient();

  const syncReposUrl = `/organizations/${orgSlug}/prevent/owner/${integratedOrgId}/repositories/sync/`;

  // we get the isSyncing value from the cache
  const isSyncingInCache = Boolean(queryClient.getQueryData([syncReposUrl]));

  // we save isSyncing to the cache when calling the mutation
  const mutationData = useMutation<SyncReposResponse, RequestError>({
    mutationFn: () =>
      fetchMutation({
        method: 'POST',
        url: syncReposUrl,
      }),
    onSuccess: data => {
      queryClient.setQueryData([syncReposUrl], data.isSyncing);
    },
    onError: () => {
      addErrorMessage('Failed to trigger repositories sync.');
    },
  });

  const isSyncing = mutationData.isPending || isSyncingInCache;

  // useQuery will automatically feed the so we don't need to care about return
  const {isSuccess, isFetching} = useQuery<boolean, Error, boolean, QueryKey>({
    queryKey: [syncReposUrl],
    queryFn: async context => {
      const result = await fetchDataQuery<SyncReposResponse>(context);

      return result[0].isSyncing;
    },
    refetchInterval: isSyncing ? POLLING_INTERVAL : undefined,
  });

  useEffect(() => {
    if (isSuccess && !isFetching) {
      queryClient.invalidateQueries({
        queryKey: [
          `/organizations/${organization.slug}/prevent/owner/${integratedOrgId}/repositories/`,
          {query: {term: searchValue}},
        ],
      });
    }
  }, [
    isFetching,
    isSuccess,
    queryClient,
    organization.slug,
    integratedOrgId,
    searchValue,
  ]);

  return {
    isSyncing,
    triggerResync: mutationData.mutateAsync,
  };
}
