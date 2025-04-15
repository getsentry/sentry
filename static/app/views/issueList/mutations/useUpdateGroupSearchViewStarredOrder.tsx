import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  getApiQueryData,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {makeFetchGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {makeFetchStarredGroupSearchViewsKey} from 'sentry/views/issueList/queries/useFetchStarredGroupSearchViews';
import type {GroupSearchView, StarredGroupSearchView} from 'sentry/views/issueList/types';

type UpdateGroupSearchViewStarredOrderVariables = {
  orgSlug: string;
  viewIds: number[];
};

export const useUpdateGroupSearchViewStarredOrder = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<void, RequestError, UpdateGroupSearchViewStarredOrderVariables>({
    mutationFn: ({orgSlug, viewIds}: UpdateGroupSearchViewStarredOrderVariables) =>
      api.requestPromise(`/organizations/${orgSlug}/group-search-views/starred/order/`, {
        method: 'PUT',
        data: {view_ids: viewIds},
      }),
    onSuccess: (_, parameters) => {
      // Reorder the existing views in the cache
      const groupSearchViews = getApiQueryData<GroupSearchView[]>(
        queryClient,
        makeFetchGroupSearchViewsKey({orgSlug: parameters.orgSlug})
      );
      if (!groupSearchViews) {
        return;
      }
      const newViewsOrder = parameters.viewIds
        .map(id => groupSearchViews.find(view => parseInt(view.id, 10) === id))
        .filter(defined);

      setApiQueryData<StarredGroupSearchView[]>(
        queryClient,
        makeFetchStarredGroupSearchViewsKey({orgSlug: parameters.orgSlug}),
        newViewsOrder
      );
    },
    onError: () => {
      addErrorMessage(t('Failed to update starred views order'));
    },
  });
};
