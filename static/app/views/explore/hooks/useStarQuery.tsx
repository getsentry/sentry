import {useCallback} from 'react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useStarQuery() {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery();

  const starQuery = useCallback(
    async (id: number, starred: boolean) => {
      await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/${id}/starred/`,
        {
          method: 'POST',
          data: {
            starred,
          },
        }
      );
      invalidateSavedQueries();
      invalidateSavedQuery();
    },
    [api, organization.slug, invalidateSavedQueries, invalidateSavedQuery]
  );

  return {starQuery};
}
