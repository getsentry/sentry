import {useMemo, useRef} from 'react';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

export type SupergroupLookup = Record<string, SupergroupDetail | null>;

/**
 * Fetch supergroup assignments for a batch of group IDs.
 * Returns a lookup map and loading state so callers can block rendering
 * until the data is available, preventing pop-in when issues are regrouped.
 */
export function useSuperGroups(groupIds: string[]): {
  data: SupergroupLookup;
  isLoading: boolean;
} {
  const organization = useOrganization();
  const requestedGroupIdsRef = useRef(groupIds);
  const hasTopIssuesUI = organization.features.includes('top-issues-ui');

  const previousRequestedGroupIds = requestedGroupIdsRef.current;

  // Stabilize the query key: if the new groupIds are a subset of what we
  // already requested (groups were removed), reuse the previous set to
  // avoid a redundant refetch.
  const requestedGroupIds = useMemo(() => {
    const prev = requestedGroupIdsRef.current;
    if (groupIds.length === 0 || prev.length < groupIds.length) {
      return groupIds;
    }
    const prevSet = new Set(prev);
    return groupIds.every(id => prevSet.has(id)) ? prev : groupIds;
  }, [groupIds]);

  requestedGroupIdsRef.current = requestedGroupIds;
  const enabled = hasTopIssuesUI && requestedGroupIds.length > 0;

  const {data: response, isLoading} = useApiQuery<{data: SupergroupDetail[]}>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/seer/supergroups/by-group/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          group_id: requestedGroupIds,
          status: 'unresolved',
        },
      },
    ],
    {
      staleTime: 30_000,
      enabled,
      retry: false,
      placeholderData: previousData => {
        if (!previousData) {
          return undefined;
        }
        const prevSet = new Set(previousRequestedGroupIds);
        return groupIds.some(id => prevSet.has(id)) ? previousData : undefined;
      },
    }
  );

  const lookup = useMemo(() => {
    if (!response?.data) {
      return {};
    }
    const result: SupergroupLookup = Object.fromEntries(groupIds.map(id => [id, null]));
    for (const sg of response.data) {
      if (sg.group_ids.length <= 1) {
        continue;
      }
      for (const groupId of sg.group_ids) {
        result[String(groupId)] = sg;
      }
    }
    return result;
  }, [response, groupIds]);

  return {
    data: lookup,
    isLoading: enabled && isLoading,
  };
}
