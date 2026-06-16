import {useCallback, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import type {User} from 'sentry/types/user';
import {useOrganization} from 'sentry/utils/useOrganization';

import {memberUsersQueryOptions, type MemberResult} from './shared';
import {useMembers} from './useMembers';

interface MemberSearchResult extends MemberResult {
  /**
   * Updates the current member search query.
   */
  onSearch: (searchTerm: string) => Promise<void>;
}

function uniqueMembers(...memberLists: User[][]) {
  return uniqBy(memberLists.flat(), ({id}) => id);
}

export function useOrganizationMemberSearch(): MemberSearchResult {
  const organization = useOrganization();
  const [search, setSearch] = useState('');
  const defaultMembersQuery = useMembers();
  const searchMembersQuery = useQuery({
    ...memberUsersQueryOptions({
      orgSlug: organization.slug,
      search,
    }),
    enabled: search !== '',
  });

  const members = useMemo(
    () => uniqueMembers(defaultMembersQuery.data ?? [], searchMembersQuery.data ?? []),
    [defaultMembersQuery.data, searchMembersQuery.data]
  );

  const handleSearch = useCallback((searchTerm: string) => {
    setSearch(searchTerm);
    return Promise.resolve();
  }, []);
  const error = searchMembersQuery.error ?? defaultMembersQuery.error;

  return {
    members,
    isPending: defaultMembersQuery.isPending,
    isFetched: defaultMembersQuery.isFetched,
    error,
    onSearch: handleSearch,
  };
}
