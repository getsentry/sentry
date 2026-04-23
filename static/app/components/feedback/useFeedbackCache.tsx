import {useCallback} from 'react';

import {useFeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {defined} from 'sentry/utils';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {FeedbackIssue, FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import {useQueryClient} from 'sentry/utils/queryClient';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData} from 'sentry/utils/queryClient';

type TFeedbackIds = 'all' | string[];

type ListCache = {
  pageParams: unknown[];
  pages: Array<ApiResponse<FeedbackIssueListItem[]>>;
};

const issueApiEndpointRegexp = /^\/organizations\/\w+\/issues\/\d+\/$/;
function isIssueEndpointUrl(query: any) {
  // v2 keys have metadata at [0] and URL at [1]
  const key = query.queryKey;
  const url =
    typeof key[0] === 'object' && key[0]?.version === 'v2'
      ? (key[1] ?? '')
      : (key[0] ?? '');
  return issueApiEndpointRegexp.test(String(url));
}

export function useFeedbackCache() {
  const queryClient = useQueryClient();
  const {getItemQueryKeys, listApiOptions} = useFeedbackApiOptions();
  const listQueryKey = listApiOptions.queryKey;

  const updateCachedQueryKey = useCallback(
    (queryKey: ApiQueryKey, payload: Partial<FeedbackIssue>) => {
      setApiQueryData<FeedbackIssue>(queryClient, queryKey, feedbackIssue =>
        feedbackIssue ? {...feedbackIssue, ...payload} : feedbackIssue
      );
    },
    [queryClient]
  );

  const updateCachedIssue = useCallback(
    (ids: TFeedbackIds, payload: Partial<FeedbackIssue>) => {
      if (ids === 'all') {
        const cache = queryClient.getQueryCache();
        const queries = cache.findAll({predicate: isIssueEndpointUrl});
        queries
          .map(query => query.queryKey as ApiQueryKey)
          .forEach(queryKey => updateCachedQueryKey(queryKey, payload));
      } else {
        ids
          .map(id => getItemQueryKeys(id).issueQueryKey)
          .filter(defined)
          .forEach(queryKey => updateCachedQueryKey(queryKey, payload));
      }
    },
    [getItemQueryKeys, queryClient, updateCachedQueryKey]
  );

  const updateCachedListPage = useCallback(
    (ids: TFeedbackIds, payload: Partial<FeedbackIssue>) => {
      const listData = queryClient.getQueryData(listQueryKey);
      if (listData) {
        const pages = listData.pages.map(page => ({
          ...page,
          json: page.json.map(item =>
            ids === 'all' || ids.includes(item.id) ? {...item, ...payload} : item
          ),
        }));
        queryClient.setQueryData(listQueryKey, {...listData, pages});
      }
    },
    [listQueryKey, queryClient]
  );

  const updateCached = useCallback(
    (ids: TFeedbackIds, data: Partial<FeedbackIssue>) => {
      updateCachedIssue(ids, data);
      updateCachedListPage(ids, data);
    },
    [updateCachedIssue, updateCachedListPage]
  );

  const invalidateCachedIssue = useCallback(
    (ids: TFeedbackIds) => {
      if (ids === 'all') {
        queryClient.invalidateQueries({predicate: isIssueEndpointUrl});
      } else {
        ids.forEach(id => {
          const queryKey = getItemQueryKeys(id).issueQueryKey;
          queryClient.invalidateQueries({queryKey});
        });
      }
    },
    [getItemQueryKeys, queryClient]
  );

  const invalidateCachedListPage = useCallback(
    (ids: TFeedbackIds) => {
      if (!listQueryKey) {
        return;
      }
      if (ids === 'all') {
        queryClient.invalidateQueries({
          queryKey: listQueryKey,
          type: 'all',
        });
      } else {
        queryClient.refetchQueries({
          queryKey: listQueryKey,
          predicate: query => {
            const data = query.state.data as ListCache | undefined;
            return Boolean(
              data?.pages.some(page => page.json.some(item => ids.includes(item.id)))
            );
          },
        });
      }
    },
    [listQueryKey, queryClient]
  );

  const invalidateCached = useCallback(
    (ids: TFeedbackIds) => {
      invalidateCachedIssue(ids);
      invalidateCachedListPage(ids);
    },
    [invalidateCachedIssue, invalidateCachedListPage]
  );

  const invalidateListCache = useCallback(() => {
    invalidateCachedListPage('all');
  }, [invalidateCachedListPage]);

  return {
    updateCached,
    invalidateCached,
    invalidateListCache,
  };
}
