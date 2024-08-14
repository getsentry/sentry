import {useCallback} from 'react';

import type {ApiResult} from 'sentry/api';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import {defined} from 'sentry/utils';
import type {FeedbackIssue, FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';

type TFeedbackIds = 'all' | string[];

export type ListCache = {
  pageParams: unknown[];
  pages: ApiResult<FeedbackIssueListItem[]>[];
};

const issueApiEndpointRegexp = /^\/organizations\/\w+\/issues\/\d+\/$/;
function isIssueEndpointUrl(query) {
  const url = query.queryKey[0] ?? '';
  return issueApiEndpointRegexp.test(String(url));
}

export default function useFeedbackCache() {
  const queryClient = useQueryClient();
  const {getItemQueryKeys, listQueryKey} = useFeedbackQueryKeys();

  const updateCachedQueryKey = useCallback(
    (queryKey: ApiQueryKey, payload: Partial<FeedbackIssue>) => {
      setApiQueryData(queryClient, queryKey, (feedbackIssue: FeedbackIssue) =>
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
      const listData = queryClient.getQueryData<ListCache>(listQueryKey);
      if (listData) {
        const pages = listData.pages.map(([data, statusText, resp]) => [
          data.map(item =>
            ids === 'all' || ids.includes(item.id) ? {...item, ...payload} : item
          ),
          statusText,
          resp,
        ]);
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
          // Only need to invalidate & re-fetch issue data. Event data will not change.
          const queryKey = getItemQueryKeys(id).issueQueryKey;
          queryClient.invalidateQueries({queryKey});
        });
      }
    },
    [getItemQueryKeys, queryClient]
  );

  const invalidateCachedListPage = useCallback(
    (ids: TFeedbackIds) => {
      queryClient.invalidateQueries({
        queryKey: listQueryKey,
        refetchPage: ([results]: ApiResult<FeedbackIssueListItem[]>) => {
          return ids === 'all' || results.some(item => ids.includes(item.id));
        },
      });
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
