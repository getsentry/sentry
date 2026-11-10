import {useCallback} from 'react';
import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  SavedQueryType,
  useInvalidateSavedQueries,
  type SavedQueryRef,
} from './useGetSavedQueries';

export function useDeleteQuery() {
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const {mutateAsync} = useMutation({
    mutationFn: ({queryId, queryType}: SavedQueryRef) =>
      fetchMutation({
        url:
          queryType === SavedQueryType.EXPLORE
            ? getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/', {
                path: {organizationIdOrSlug: organization.slug, id: String(queryId)},
              })
            : getApiUrl('/organizations/$organizationIdOrSlug/discover/saved/$queryId/', {
                path: {organizationIdOrSlug: organization.slug, queryId: String(queryId)},
              }),
        method: 'DELETE',
      }),
  });

  const deleteQuery = useCallback(
    async (savedQueryRef: SavedQueryRef) => {
      await mutateAsync(savedQueryRef);
      invalidateSavedQueries();
    },
    [mutateAsync, invalidateSavedQueries]
  );

  return {deleteQuery};
}
