import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getStarredSavedQueriesQueryKey,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useReorderStarredSavedQueries() {
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();

  const {mutate} = useMutation({
    mutationFn: (queries: SavedQuery[]) =>
      api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/starred/order/`,
        {
          method: 'PUT',
          data: {
            query_ids: queries.map(query => query.id),
          },
        }
      ),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: getStarredSavedQueriesQueryKey(organization),
      });
    },
  });

  return mutate;
}
