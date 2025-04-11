import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useVisitQuery() {
  const api = useApi();
  const organization = useOrganization();

  const visitQuery = useCallback(
    async (id: string) => {
      try {
        await api.requestPromise(
          `/organizations/${organization.slug}/explore/saved/${id}/visit/`,
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
