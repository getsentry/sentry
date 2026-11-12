import {useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useVisitQuery(id?: string) {
  const organization = useOrganization();

  const {mutate: visitQuery} = useMutation({
    mutationFn: (path: {id: string; organizationIdOrSlug: string}) =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/visit/', {
          path,
        }),
        method: 'POST',
      }),
  });

  useEffect(() => {
    if (id) {
      visitQuery({organizationIdOrSlug: organization.slug, id});
    }
  }, [id, organization.slug, visitQuery]);
}
