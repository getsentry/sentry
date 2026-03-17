import {useCallback} from 'react';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useInvalidateSavedQueries,
  type ReadableSavedQuery,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useReorderStarredSavedQueries() {
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const reorderStarredSavedQueries = useCallback(
    async (queries: SavedQuery[]) => {
      const idOrder = queries.map(q => q.id);
      const starredUrl = getApiUrl(
        '/organizations/$organizationIdOrSlug/explore/saved/',
        {
          path: {organizationIdOrSlug: organization.slug},
        }
      );
      queryClient.setQueriesData<ReadableSavedQuery[]>(
        {
          predicate: query =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === starredUrl &&
            (query.queryKey[1] as any)?.query?.starred !== undefined,
        },
        oldData => {
          if (!oldData) return oldData;
          return [...oldData].sort((a, b) => {
            const ai = idOrder.indexOf(a.id);
            const bi = idOrder.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
        }
      );
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
    [api, organization.slug, queryClient, invalidateSavedQueries]
  );

  return reorderStarredSavedQueries;
}
