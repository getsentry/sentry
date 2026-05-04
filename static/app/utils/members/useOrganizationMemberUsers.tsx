import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';

import {memberUsersQueryOptions} from './shared';

interface UseOrganizationMemberUsersOptions {
  limit?: number;
}

export function useOrganizationMemberUsers({
  limit,
}: UseOrganizationMemberUsersOptions = {}) {
  const organization = useOrganization();

  return useQuery(
    memberUsersQueryOptions({
      orgSlug: organization.slug,
      limit,
    })
  );
}
