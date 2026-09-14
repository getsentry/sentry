import {useCallback} from 'react';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useDeleteQuery() {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const deleteQuery = useCallback(
    async (id: number) => {
      await api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/', {
          path: {organizationIdOrSlug: organization.slug, id},
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
