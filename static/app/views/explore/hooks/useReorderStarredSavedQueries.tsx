import {useQueryClient} from '@tanstack/react-query';
import {useMutation} from '@tanstack/react-query';

import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  starredSavedQueriesApiOptions,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useReorderStarredSavedQueries() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {queryKey} = starredSavedQueriesApiOptions(organization);

  const {mutate} = useMutation({
    mutationFn: (queries: SavedQuery[]) =>
      fetchMutation({
        url: `/organizations/${organization.slug}/explore/saved/starred/order/`,
        method: 'PUT',
        data: {
          query_ids: queries.map(query => query.id),
        },
      }),
    onMutate: (queries: SavedQuery[]) => {
      queryClient.setQueryData(queryKey, prevData =>
        prevData ? {...prevData, json: queries} : prevData
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });

  return mutate;
}
