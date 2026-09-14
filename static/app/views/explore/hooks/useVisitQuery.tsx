import {useCallback} from 'react';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useVisitQuery() {
  const api = useApi();
  const organization = useOrganization();

  const visitQuery = useCallback(
    async (id: string) => {
      try {
        await api.requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/visit/', {
            path: {organizationIdOrSlug: organization.slug, id},
          }),
          {
            method: 'POST',
          }
        );
      } catch (_err) {
        // Don't do anything
      }
    },
    [api, organization.slug]
  );

  return visitQuery;
}
