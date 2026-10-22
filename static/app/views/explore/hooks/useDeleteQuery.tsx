import {useCallback} from 'react';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  SavedQueryType,
  useInvalidateSavedQueries,
  type SavedQueryRef,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useDeleteQuery() {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const deleteQuery = useCallback(
    async ({queryId, queryType}: SavedQueryRef) => {
      await api.requestPromise(
        queryType === SavedQueryType.EXPLORE
          ? getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/', {
              path: {organizationIdOrSlug: organization.slug, id: String(queryId)},
            })
          : getApiUrl('/organizations/$organizationIdOrSlug/discover/saved/$queryId/', {
              path: {organizationIdOrSlug: organization.slug, queryId: String(queryId)},
            }),
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
