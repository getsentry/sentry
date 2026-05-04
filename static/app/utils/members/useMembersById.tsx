import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  memberUsersQueryOptions,
  normalizeMemberValues,
  type MemberResult,
} from './shared';

interface UseMembersByIdOptions {
  /**
   * Fetches specified members by id if necessary and only provides those
   * members.
   */
  ids: string[];
}

/**
 * Provides organization member users for the specified user ids.
 *
 * This hook requires explicit ids. Use `useOrganizationMemberUsers`
 * for the default cached member list or `useOrganizationMemberSearch` for
 * searchable member selectors.
 */
export function useMembersById({ids}: UseMembersByIdOptions): MemberResult {
  const organization = useOrganization();
  const normalizedIds = useMemo(() => normalizeMemberValues(ids), [ids]);
  const hasIds = normalizedIds.length > 0;
  const query = useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      ids: normalizedIds,
    }),
    enabled: hasIds,
  });

  return {
    members: hasIds ? (query.data ?? []) : [],
    isPending: hasIds && query.isPending,
    isFetched: !hasIds || query.isFetched,
    error: query.error instanceof RequestError ? query.error : null,
  };
}
