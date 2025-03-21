import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useDeleteQuery() {
  const api = useApi();
  const organization = useOrganization();

  const deleteQuery = useCallback(
    (id: number) => {
      api.requestPromise(`/organizations/${organization.slug}/explore/saved/${id}/`, {
        method: 'DELETE',
      });
    },
    [api, organization.slug]
  );

  return {deleteQuery};
}
