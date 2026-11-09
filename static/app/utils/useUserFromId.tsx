import type {User} from 'sentry/types/user';

import {getApiUrl} from './api/getApiUrl';
import {useApiQuery} from './queryClient';
import {useOrganization} from './useOrganization';

export function useUserFromId({id}: {id: number | undefined}) {
  const organization = useOrganization();

  return useApiQuery<User>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/users/$userId/', {
        path: {organizationIdOrSlug: organization.slug, userId: id!},
      }),
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled: typeof id === 'number',
    }
  );
}
