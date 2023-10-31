import {useCallback} from 'react';

import type {ApiResult} from 'sentry/api';
import getFeedbackItemQueryKey from 'sentry/components/feedback/getFeedbackItemQueryKey';
import useFeedbackListQueryKey from 'sentry/components/feedback/useFeedbackListQueryKey';
import type {FeedbackIssue, FeedbackIssueList} from 'sentry/utils/feedback/types';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export type ListCache = {
  pageParams: unknown[];
  pages: ApiResult<FeedbackIssueList>[];
};

export default function useFeedbackCache() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const listQueryKey = useFeedbackListQueryKey({organization});

  const updateCachedIssue = useCallback(
    (ids: string[], data: Partial<FeedbackIssue>) => {
      ids
        .map(
          feedbackId => getFeedbackItemQueryKey({feedbackId, organization}).issueQueryKey
        )
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
    [organization, queryClient]
  );

  const updateCachedListPage = useCallback(
    (ids: string[], payload: Partial<FeedbackIssue>) => {
      const listData = queryClient.getQueryData<ListCache>(listQueryKey);

      const pages = listData?.pages.map(([data, statusText, resp]) => [
        data.map(item => (ids.includes(item.id) ? {...item, ...payload} : item)),
        statusText,
        resp,
      ]);
      queryClient.setQueryData(listQueryKey, {...listData, pages});
    },
    [listQueryKey, queryClient]
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
        const {issueQueryKey: queryKey} = getFeedbackItemQueryKey({
          feedbackId,
          organization,
        });
        queryClient.invalidateQueries({queryKey});
      });
    },
    [organization, queryClient]
  );

  const invalidateCachedListPage = useCallback(
    (ids: string[]) => {
      queryClient.invalidateQueries({
        queryKey: listQueryKey,
        refetchPage: ([results]: ApiResult<FeedbackIssueList>) => {
          return results.some(item => ids.includes(item.id));
        },
      });
    },
    [listQueryKey, queryClient]
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
