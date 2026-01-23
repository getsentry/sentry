import type {User} from '@sentry/core';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function useUserFromId({id}: {id: number | undefined}) {
  const organization = useOrganization();

  const {isPending, isError, data} = useApiQuery<User>(
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

  if (isError) {
    return {isPending: false, data: {name: id}};
  }

  return {isPending, data};
}
