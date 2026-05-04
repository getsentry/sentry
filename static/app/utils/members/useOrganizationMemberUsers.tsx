import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';

import {membersQueryOptions, selectMemberUsersFromResponse} from './shared';

type UseOrganizationMemberUsersOptions = {
  limit?: number;
};

export function useOrganizationMemberUsers({
  limit,
}: UseOrganizationMemberUsersOptions = {}) {
  const organization = useOrganization();

  return useQuery({
    ...membersQueryOptions({
      orgSlug: organization.slug,
      limit,
    }),
    select: selectMemberUsersFromResponse,
  });
}
