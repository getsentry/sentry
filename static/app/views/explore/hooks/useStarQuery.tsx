import {useCallback} from 'react';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  SavedQueryType,
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
  type SavedQueryRef,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useStarQuery() {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery();

  const starQuery = useCallback(
    async ({queryId, queryType}: SavedQueryRef, starred: boolean) => {
      await api.requestPromise(
        queryType === SavedQueryType.EXPLORE
          ? getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/starred/', {
              path: {organizationIdOrSlug: organization.slug, id: String(queryId)},
            })
          : getApiUrl(
              '/organizations/$organizationIdOrSlug/discover/saved/$id/starred/',
              {
                path: {organizationIdOrSlug: organization.slug, id: String(queryId)},
              }
            ),
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
