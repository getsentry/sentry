import type {User} from '@sentry/types';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function UseUserFromId({id}: {id: number}) {
  const organization = useOrganization();

  const {isPending, isError, data} = useApiQuery<User>(
    [`/organizations/${organization.slug}/users/${id}/`],
    {staleTime: 0}
  );

  if (isError) {
    return {isPending: false, data: {name: id}};
  }

  return {isPending, data};
}
