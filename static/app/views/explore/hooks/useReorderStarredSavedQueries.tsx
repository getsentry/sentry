import {useMutation} from '@tanstack/react-query';

import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useInvalidateSavedQueries,
  type SavedQueryRef,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useReorderStarredSavedQueries() {
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const {mutate} = useMutation({
    mutationFn: (queries: SavedQueryRef[]) =>
      apiFetch({
        queryKey: [
          getApiUrl(
            '/organizations/$organizationIdOrSlug/explore/all-queries/starred/order/',
            {
              path: {organizationIdOrSlug: organization.slug},
            }
          ),
          {
            method: 'PUT',
            data: {
              queries: queries.map(({queryId, queryType}) => ({
                type: queryType,
                query_id: Number(queryId),
              })),
            },
          },
        ],
      }),
    onSettled: () => {
      invalidateSavedQueries();
    },
  });

  return mutate;
}
