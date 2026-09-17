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
    async ({id, queryType}: SavedQueryRef) => {
      await api.requestPromise(
        queryType === SavedQueryType.EXPLORE
          ? getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/', {
              path: {organizationIdOrSlug: organization.slug, id: String(id)},
            })
          : getApiUrl('/organizations/$organizationIdOrSlug/discover/saved/$queryId/', {
              path: {organizationIdOrSlug: organization.slug, queryId: String(id)},
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
