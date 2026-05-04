import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {User} from 'sentry/types/user';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  membersQueryOptions,
  type MemberResult,
  selectMemberUsersFromResponse,
} from './shared';

type UseMembersOptions =
  | {
      /**
       * When provided, fetches specified members by email if necessary and only
       * provides those members.
       */
      emails: string[];
      ids?: string[];
    }
  | {
      /**
       * When provided, fetches specified members by id if necessary and only
       * provides those members.
       */
      ids: string[];
      emails?: string[];
    };

function normalizeMemberValues(values: string[] | undefined) {
  return values ? Array.from(new Set(values)).sort() : [];
}

function filterUsersByMemberOptions(
  users: User[],
  ids: string[],
  emails: string[]
): User[] {
  const idSet = new Set(ids);
  const emailSet = new Set(emails);

  return users.filter(user => idSet.has(user.id) || emailSet.has(user.email));
}

/**
 * Provides organization member users.
 *
 * This hook requires explicit member filters. Use `useOrganizationMemberUsers`
 * for the default cached member list or `useOrganizationMemberSearch` for
 * searchable member selectors.
 */
export function useMembers({ids, emails}: UseMembersOptions): MemberResult {
  const organization = useOrganization();
  const normalizedIds = useMemo(() => normalizeMemberValues(ids), [ids]);
  const normalizedEmails = useMemo(() => normalizeMemberValues(emails), [emails]);
  const hasFilters = normalizedIds.length > 0 || normalizedEmails.length > 0;
  const query = useQuery({
    ...membersQueryOptions({
      orgSlug: organization.slug,
      ids: normalizedIds,
      emails: normalizedEmails,
    }),
    enabled: hasFilters,
    select: selectMemberUsersFromResponse,
  });

  const members = useMemo(
    () =>
      hasFilters
        ? filterUsersByMemberOptions(query.data ?? [], normalizedIds, normalizedEmails)
        : [],
    [hasFilters, normalizedEmails, normalizedIds, query.data]
  );

  return {
    members,
    fetching: hasFilters && query.isPending,
    initiallyLoaded: !hasFilters || query.isFetched,
    fetchError: query.error as RequestError | null,
  };
}
