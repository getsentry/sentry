import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useDeleteQuery() {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const deleteQuery = useCallback(
    async (id: number) => {
      await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/${id}/`,
        {
          method: 'DELETE',
        }
      );
      invalidateSavedQueries();
    },
    [api, organization.slug, invalidateSavedQueries]
  );

  return {deleteQuery};
}
