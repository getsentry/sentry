import {useQueryClient, useMutation} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
import {groupSearchViewsApiOptions} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import type {StarredGroupSearchView} from 'sentry/views/issueList/types';

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
      const groupSearchViews = queryClient.getQueryData(
        groupSearchViewsApiOptions({orgSlug: parameters.orgSlug}).queryKey
      )?.json;
      if (!groupSearchViews) {
        return;
      }
      const newViewsOrder = parameters.viewIds
        .map(id => groupSearchViews.find(view => parseInt(view.id, 10) === id))
        .filter(defined);

      queryClient.setQueryData(
        starredGroupSearchViewsApiOptions({orgSlug: parameters.orgSlug}).queryKey,
        prevData =>
          prevData
            ? {...prevData, json: newViewsOrder as StarredGroupSearchView[]}
            : prevData
      );
    },
    onError: () => {
      addErrorMessage(t('Failed to update starred views order'));
    },
  });
};
