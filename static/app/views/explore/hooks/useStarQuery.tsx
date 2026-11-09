import {useCallback} from 'react';
import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {
  SavedQueryType,
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
  type SavedQueryRef,
} from './useGetSavedQueries';

export function useStarQuery() {
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery();

  const {mutateAsync} = useMutation({
    mutationFn: ({queryId, queryType, starred}: SavedQueryRef & {starred: boolean}) =>
      fetchMutation({
        url:
          queryType === SavedQueryType.EXPLORE
            ? getApiUrl(
                '/organizations/$organizationIdOrSlug/explore/saved/$id/starred/',
                {
                  path: {organizationIdOrSlug: organization.slug, id: String(queryId)},
                }
              )
            : getApiUrl(
                '/organizations/$organizationIdOrSlug/discover/saved/$id/starred/',
                {
                  path: {organizationIdOrSlug: organization.slug, id: String(queryId)},
                }
              ),
        method: 'POST',
        data: {
          starred,
        },
      }),
  });

  const starQuery = useCallback(
    async ({queryId, queryType}: SavedQueryRef, starred: boolean) => {
      await mutateAsync({queryId, queryType, starred});
      invalidateSavedQueries();
      invalidateSavedQuery();
    },
    [mutateAsync, invalidateSavedQueries, invalidateSavedQuery]
  );

  return {starQuery};
}
