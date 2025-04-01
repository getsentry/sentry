import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useVisitQuery() {
  const api = useApi();
  const organization = useOrganization();

  const visitQuery = useCallback(
    async (id: string) => {
      await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/${id}/visit/`,
        {
          method: 'POST',
        }
      );
    },
    [api, organization.slug]
  );

  return visitQuery;
}
