import {useCallback, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';

import {
  getRequestError,
  membersQueryOptions,
  type MemberSearchResult,
  selectMemberUsersFromResponse,
  uniqueMembers,
} from './shared';
import {useOrganizationMemberUsers} from './useOrganizationMemberUsers';

export function useOrganizationMemberSearch(): MemberSearchResult {
  const organization = useOrganization();
  const [search, setSearch] = useState('');
  const defaultMembersQuery = useOrganizationMemberUsers();
  const searchMembersQuery = useQuery({
    ...membersQueryOptions({
      orgSlug: organization.slug,
      search,
    }),
    enabled: search !== '',
    select: selectMemberUsersFromResponse,
  });

  const members = useMemo(
    () => uniqueMembers(defaultMembersQuery.data ?? [], searchMembersQuery.data ?? []),
    [defaultMembersQuery.data, searchMembersQuery.data]
  );

  const handleSearch = useCallback((searchTerm: string) => {
    setSearch(searchTerm);
    return Promise.resolve();
  }, []);

  return {
    members,
    isPending: defaultMembersQuery.isPending || searchMembersQuery.isFetching,
    isFetched: defaultMembersQuery.isFetched,
    error:
      getRequestError(searchMembersQuery.error) ??
      getRequestError(defaultMembersQuery.error),
    onSearch: handleSearch,
  };
}
