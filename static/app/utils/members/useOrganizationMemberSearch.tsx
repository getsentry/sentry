import {useCallback, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import type {User} from 'sentry/types/user';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import {memberUsersQueryOptions, type MemberResult} from './shared';
import {useOrganizationMemberUsers} from './useOrganizationMemberUsers';

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
  const defaultMembersQuery = useOrganizationMemberUsers();
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
  const error =
    searchMembersQuery.error instanceof RequestError
      ? searchMembersQuery.error
      : defaultMembersQuery.error instanceof RequestError
        ? defaultMembersQuery.error
        : null;

  return {
    members,
    isPending: defaultMembersQuery.isPending || searchMembersQuery.isFetching,
    isFetched: defaultMembersQuery.isFetched,
    error,
    onSearch: handleSearch,
  };
}
