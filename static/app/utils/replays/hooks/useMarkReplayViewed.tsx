import {useCallback} from 'react';

import type {ApiResult} from 'sentry/api';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type TData = unknown;
type TError = unknown;
type TVariables = {projectSlug: string; replayId: string};
type TContext = unknown;

import useOrganization from 'sentry/utils/useOrganization';

export default function useMarkReplayViewed() {
  const organization = useOrganization();
  const api = useApi({
    persistInFlight: false,
  });
  const queryClient = useQueryClient();

  const updateCache = useCallback(
    ({replayId}: TVariables, hasViewed: boolean) => {
      const cache = queryClient.getQueryCache();
      const cachedResponses = cache.findAll([
        `/organizations/${organization.slug}/replays/${replayId}/`,
      ]);
      cachedResponses.forEach(cached => {
        const [data, ...rest] = cached.state.data as ApiResult<{
          data: Record<string, unknown>;
        }>;
        cached.setData([
          {
            data: {
              ...data.data,
              has_viewed: hasViewed,
            },
          },
          ...rest,
        ]);
      });
    },
    [organization.slug, queryClient]
  );

  return useMutation<TData, TError, TVariables, TContext>({
    onMutate: variables => {
      updateCache(variables, true);
    },
    mutationFn: ({projectSlug, replayId}) => {
      const url = `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`;
      return fetchMutation(api)(['POST', url]);
    },
    onError: (_error, variables) => {
      updateCache(variables, false);
    },
    cacheTime: 0,
    retry: false,
  });
}
