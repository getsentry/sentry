import {useQueryClient, useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {starredGroupSearchViewsApiOptions} from 'sentry/views/issueList/queries/starredGroupSearchViews';
import {groupSearchViewsApiOptions} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';

type UpdateGroupSearchViewStarredOrderVariables = {
  orgSlug: string;
  viewIds: number[];
};

export const useUpdateGroupSearchViewStarredOrder = () => {
  const queryClient = useQueryClient();

  return useMutation<void, RequestError, UpdateGroupSearchViewStarredOrderVariables>({
    mutationFn: ({orgSlug, viewIds}: UpdateGroupSearchViewStarredOrderVariables) =>
      fetchMutation<void>({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/group-search-views/starred/order/',
          {
            path: {organizationIdOrSlug: orgSlug},
          }
        ),
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
        prevData => (prevData ? {...prevData, json: newViewsOrder} : prevData)
      );
    },
    onError: () => {
      toast.error(t('Failed to update starred views order'));
    },
  });
};
