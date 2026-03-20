import {useCallback} from 'react';

import type {ApiResult} from 'sentry/api';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

type SupergroupState = Record<string, SupergroupDetail | null>;

interface Props {
  bufferLimit?: number;
}

/**
 * Query results for whether an Issue/Group belongs to a supergroup.
 */
export function useSuperGroupForIssues({bufferLimit = 25}: Props = {}) {
  const organization = useOrganization();

  const cache = useAggregatedQueryKeys<string, SupergroupState>({
    cacheKey: `/organizations/${organization.slug}/seer/supergroup-lookup/`,
    bufferLimit,
    getQueryKey: useCallback(
      (ids: readonly string[]): ApiQueryKey => [
        getApiUrl('/organizations/$organizationIdOrSlug/seer/supergroup-lookup/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        {
          query: {
            issue_id: ids.join(','),
          },
        },
      ],
      [organization.slug]
    ),
    responseReducer: useCallback(
      (
        prevState: undefined | SupergroupState,
        response: ApiResult,
        aggregates: readonly string[]
      ) => {
        const defaults = Object.fromEntries(
          aggregates.map(id => [id, null])
        ) as SupergroupState;
        return {...defaults, ...prevState, ...(response[0] as SupergroupState)};
      },
      []
    ),
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
