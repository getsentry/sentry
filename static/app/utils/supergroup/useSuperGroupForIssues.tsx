import {useCallback} from 'react';

import type {ApiResult} from 'sentry/api';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

type SupergroupState = Record<string, SupergroupDetail | null>;

function supergroupReducer(
  prevState: undefined | SupergroupState,
  response: ApiResult,
  aggregates: readonly string[]
): undefined | SupergroupState {
  const defaults = Object.fromEntries(
    aggregates.map(id => [id, null])
  ) as SupergroupState;
  return {...defaults, ...prevState, ...response[0]};
}

/**
 * Query results for whether an Issue/Group belongs to a supergroup.
 */
export function useSuperGroupForIssues() {
  const organization = useOrganization();

  const cache = useAggregatedQueryKeys<string, SupergroupState>({
    cacheKey: `/organizations/${organization.slug}/seer/supergroup-lookup/`,
    bufferLimit: 25,
    getQueryKey: useCallback(
      (ids: readonly string[]): ApiQueryKey => [
        getApiUrl('/organizations/$organizationIdOrSlug/seer/supergroups/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {
          query: {
            query: `issue.id:[${ids.join(',')}]`,
          },
        },
      ],
      [organization.slug]
    ),
    responseReducer: supergroupReducer,
  });

  const getSuperGroupForIssue = useCallback(
    (id: string): SupergroupDetail | null | undefined => {
      cache.buffer([id]);
      return cache.data?.[id];
    },
    [cache]
  );

  return {getSuperGroupForIssue};
}
