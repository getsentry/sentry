import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useInvalidateSavedQueries,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useReorderStarredSavedQueries() {
  const organization = useOrganization();
  const api = useApi();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const reorderStarredSavedQueries = useCallback(
    async (queries: SavedQuery[]) => {
      await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/starred/order/`,
        {
          method: 'PUT',
          data: {
            query_ids: queries.map(query => query.id),
          },
        }
      );
      invalidateSavedQueries();
    },
    [api, organization.slug, invalidateSavedQueries]
  );

  return reorderStarredSavedQueries;
}
