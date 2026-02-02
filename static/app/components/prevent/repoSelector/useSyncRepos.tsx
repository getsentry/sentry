import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchDataQuery,
  fetchMutation,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
  type QueryFunctionContext,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

const POLLING_INTERVAL_MS = 2000;

type SyncReposResponse = {
  isSyncing: boolean;
};

type QueryKey = [url: string];

export function useSyncRepos({searchValue}: {searchValue?: string}) {
  /**
  This hook is used to sync repositories from an integrated org with GitHub.
  It periodically pings the endpoint to check if the sync is complete and updates the cache,
  used to later invalidate the queries when the sync is complete.
  */
  const organization = useOrganization();
  const orgSlug = organization.slug;
  const {integratedOrgId} = usePreventContext();
  const queryClient = useQueryClient();

  const syncReposUrl = getApiUrl(
    '/organizations/$organizationIdOrSlug/prevent/owner/$owner/repositories/sync/',
    {path: {organizationIdOrSlug: orgSlug, owner: integratedOrgId!}}
  );

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

  // useQuery periodically pings the endpoint to check if the sync is complete and updates the cache
  useQuery<boolean, Error, boolean, QueryKey>({
    queryKey: [syncReposUrl],
    queryFn: async context => {
      const result = await fetchDataQuery<SyncReposResponse>(
        context as unknown as QueryFunctionContext<ApiQueryKey, unknown>
      );

      return result[0].isSyncing;
    },
    refetchInterval: isSyncing ? POLLING_INTERVAL_MS : undefined,
    enabled: !!integratedOrgId,
  });

  useEffect(() => {
    if (!isSyncing) {
      queryClient.invalidateQueries({
        queryKey: [
          `/organizations/${organization.slug}/prevent/owner/${integratedOrgId}/repositories/`,
          {query: {term: searchValue}},
        ],
      });
    }
  }, [isSyncing, queryClient, organization.slug, integratedOrgId, searchValue]);

  return {
    isSyncing,
    triggerResync: mutationData.mutateAsync,
  };
}
