import {useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import type {Member} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {useOrganization} from 'sentry/utils/useOrganization';

import {memberUsersQueryOptions, normalizeMemberValues} from './shared';

interface UseMembersOptions {
  enabled?: boolean;
  ids?: string[];
  limit?: number;
}

/**
 * Scan existing query cache entries for member/user list responses that
 * already contain the requested user IDs. This avoids redundant fetches
 * when the data is already loaded by another hook (e.g. useProjectMembersQueryOptions).
 */
function findMembersInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  orgSlug: string,
  ids: string[]
): ApiResponse<Member[]> | undefined {
  const idSet = new Set(ids);
  const prefixes = [
    `/organizations/${orgSlug}/members/`,
    `/organizations/${orgSlug}/users/`,
  ];

  const cached = queryClient.getQueriesData<ApiResponse<Member[]>>({
    predicate: query => {
      const url = query.queryKey[0];
      return typeof url === 'string' && prefixes.some(prefix => url.startsWith(prefix));
    },
  });

  for (const [, data] of cached) {
    if (!data?.json) {
      continue;
    }
    const matchedMembers = data.json.filter(m => m.user && idSet.has(m.user.id));
    if (matchedMembers.length === ids.length) {
      return {json: matchedMembers, headers: data.headers};
    }
  }

  return undefined;
}

export function useMembers({enabled = true, ids, limit}: UseMembersOptions = {}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const normalizedIds = useMemo(() => normalizeMemberValues(ids), [ids]);
  const hasIdFilter = ids !== undefined;
  const hasIds = normalizedIds.length > 0;

  const cachedData = useMemo(() => {
    if (!hasIdFilter || !hasIds) {
      return;
    }
    return findMembersInCache(queryClient, organization.slug, normalizedIds);
  }, [queryClient, organization.slug, normalizedIds, hasIdFilter, hasIds]);

  return useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      ids: hasIdFilter ? normalizedIds : undefined,
      limit,
    }),
    enabled: enabled && (!hasIdFilter || hasIds) && !cachedData,
    initialData: cachedData,
  });
}
