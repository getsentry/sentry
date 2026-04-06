import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getStarredSavedQueriesQueryKey,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function useReorderStarredSavedQueries() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey = getStarredSavedQueriesQueryKey(organization);

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
      setApiQueryData<SavedQuery[]>(queryClient, queryKey, queries);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });

  return mutate;
}
