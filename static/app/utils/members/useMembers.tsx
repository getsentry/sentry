import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';

import {memberUsersQueryOptions, normalizeMemberValues} from './shared';

interface UseMembersOptions {
  enabled?: boolean;
  ids?: string[];
  limit?: number;
}

export function useMembers({enabled = true, ids, limit}: UseMembersOptions = {}) {
  const organization = useOrganization();
  const normalizedIds = useMemo(() => normalizeMemberValues(ids), [ids]);
  const hasIdFilter = ids !== undefined;
  const hasIds = normalizedIds.length > 0;

  return useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      ids: hasIdFilter ? normalizedIds : undefined,
      limit,
    }),
    enabled: enabled && (!hasIdFilter || hasIds),
  });
}
