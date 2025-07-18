import type {User} from '@sentry/core';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function useUserFromId({id}: {id: number | undefined}) {
  const organization = useOrganization();

  const {isPending, isError, data} = useApiQuery<User>(
    [`/organizations/${organization.slug}/users/${id}/`],
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
