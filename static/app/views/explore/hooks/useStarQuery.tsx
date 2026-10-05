import {useCallback} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  SavedQueryType,
  getSavedQueryKey,
  starredSavedQueriesApiOptions,
  useInvalidateSavedQueries,
  type CombinedSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useStarQuery() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const starredQueryKey = starredSavedQueriesApiOptions(organization).queryKey;

  const {mutateAsync} = useMutation({
    mutationFn: ({
      savedQuery,
      starred,
    }: {
      savedQuery: CombinedSavedQuery;
      starred: boolean;
    }) =>
      fetchMutation({
        url:
          savedQuery.queryType === SavedQueryType.EXPLORE
            ? getApiUrl(
                '/organizations/$organizationIdOrSlug/explore/saved/$id/starred/',
                {
                  path: {
                    organizationIdOrSlug: organization.slug,
                    id: String(savedQuery.id),
                  },
                }
              )
            : getApiUrl(
                '/organizations/$organizationIdOrSlug/discover/saved/$id/starred/',
                {
                  path: {
                    organizationIdOrSlug: organization.slug,
                    id: String(savedQuery.id),
                  },
                }
              ),
        method: 'POST',
        data: {starred},
      }),
    onMutate: ({
      savedQuery,
      starred,
    }: {
      savedQuery: CombinedSavedQuery;
      starred: boolean;
    }) => {
      const key = getSavedQueryKey(savedQuery);
      queryClient.setQueryData(starredQueryKey, prevData => {
        if (!prevData) {
          return prevData;
        }
        const json = prevData.json.filter(row => getSavedQueryKey(row) !== key);
        return {
          ...prevData,
          json: starred ? [...json, savedQuery] : json,
        };
      });
    },
    onSettled: () => {
      invalidateSavedQueries();
    },
  });

  const starQuery = useCallback(
    (savedQuery: CombinedSavedQuery, starred: boolean) =>
      mutateAsync({savedQuery, starred}),
    [mutateAsync]
  );

  return {starQuery};
}
