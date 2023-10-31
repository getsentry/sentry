import {useCallback} from 'react';

import type {ApiResult} from 'sentry/api';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import type {FeedbackIssue, FeedbackIssueList} from 'sentry/utils/feedback/types';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';

export type ListCache = {
  pageParams: unknown[];
  pages: ApiResult<FeedbackIssueList>[];
};

export default function useFeedbackCache() {
  const queryClient = useQueryClient();
  const {getItemQueryKeys, getListQueryKey} = useFeedbackQueryKeys();

  const updateCachedIssue = useCallback(
    (ids: string[], data: Partial<FeedbackIssue>) => {
      ids
        .map(id => getItemQueryKeys(id).issueQueryKey)
        .forEach(issueQueryKey => {
          if (!issueQueryKey) {
            return;
          }
          setApiQueryData(queryClient, issueQueryKey, (feedbackIssue: FeedbackIssue) => {
            return feedbackIssue
              ? {
                  ...feedbackIssue,
                  ...data,
                }
              : feedbackIssue;
          });
        });
    },
    [getItemQueryKeys, queryClient]
  );

  const updateCachedListPage = useCallback(
    (ids: string[], payload: Partial<FeedbackIssue>) => {
      const queryKey = getListQueryKey();
      const listData = queryClient.getQueryData<ListCache>(queryKey);

      const pages = listData?.pages.map(([data, statusText, resp]) => [
        data.map(item => (ids.includes(item.id) ? {...item, ...payload} : item)),
        statusText,
        resp,
      ]);
      queryClient.setQueryData(queryKey, {...listData, pages});
    },
    [getListQueryKey, queryClient]
  );

  const updateCached = useCallback(
    (ids: string[], data: Partial<FeedbackIssue>) => {
      updateCachedIssue(ids, data);
      updateCachedListPage(ids, data);
    },
    [updateCachedIssue, updateCachedListPage]
  );

  const invalidateCachedIssue = useCallback(
    (ids: string[]) => {
      ids.forEach(feedbackId => {
        // Only need to invalidate & re-fetch issue data. Event data will not change.
        const {issueQueryKey: queryKey} = getItemQueryKeys(feedbackId);
        queryClient.invalidateQueries({queryKey});
      });
    },
    [getItemQueryKeys, queryClient]
  );

  const invalidateCachedListPage = useCallback(
    (ids: string[]) => {
      queryClient.invalidateQueries({
        queryKey: getListQueryKey(),
        refetchPage: ([results]: ApiResult<FeedbackIssueList>) => {
          return results.some(item => ids.includes(item.id));
        },
      });
    },
    [getListQueryKey, queryClient]
  );

  const invalidateCached = useCallback(
    (ids: string[]) => {
      invalidateCachedIssue(ids);
      invalidateCachedListPage(ids);
    },
    [invalidateCachedIssue, invalidateCachedListPage]
  );

  return {
    updateCached,
    invalidateCached,
  };
}
