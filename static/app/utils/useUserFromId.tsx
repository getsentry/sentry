import {useQuery} from '@tanstack/react-query';

import type {User} from 'sentry/types/user';

import {apiOptions} from './api/apiOptions';
import {useOrganization} from './useOrganization';

export function useUserFromId({id}: {id: number | undefined}) {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<User>()('/organizations/$organizationIdOrSlug/users/$userId/', {
      path: {organizationIdOrSlug: organization.slug, userId: id!},
      staleTime: Infinity,
    }),
    retry: false,
    enabled: typeof id === 'number',
  });
}
