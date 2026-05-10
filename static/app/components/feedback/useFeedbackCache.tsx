import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {useFeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {defined} from 'sentry/utils';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {FeedbackIssue, FeedbackIssueListItem} from 'sentry/utils/feedback/types';

type TFeedbackIds = 'all' | string[];

type ListCache = {
  pageParams: unknown[];
  pages: Array<ApiResponse<FeedbackIssueListItem[]>>;
};

const issueApiEndpointRegexp = /^\/organizations\/\w+\/issues\/\d+\/$/;
function isIssueEndpointUrl(query: {queryKey: readonly unknown[]}) {
  const url = safeParseQueryKey(query.queryKey)?.url;
  return url !== undefined && issueApiEndpointRegexp.test(url);
}

export function useFeedbackCache() {
  const queryClient = useQueryClient();
  const {getItemApiOptions, listApiOptions} = useFeedbackApiOptions();
  const listQueryKey = listApiOptions.queryKey;

  const updateCachedQueryKey = useCallback(
    (queryKey: readonly unknown[], payload: Partial<FeedbackIssue>) => {
      queryClient.setQueryData(queryKey, (prev: ApiResponse<FeedbackIssue> | undefined) =>
        prev ? {...prev, json: {...prev.json, ...payload}} : prev
      );
    },
    [queryClient]
  );

  const updateCachedIssue = useCallback(
    (ids: TFeedbackIds, payload: Partial<FeedbackIssue>) => {
      if (ids === 'all') {
        const cache = queryClient.getQueryCache();
        const queries = cache.findAll({predicate: isIssueEndpointUrl});
        queries.forEach(query => updateCachedQueryKey(query.queryKey, payload));
      } else {
        ids
          .map(id => getItemApiOptions(id).issueApiOptions?.queryKey)
          .filter(defined)
          .forEach(queryKey => updateCachedQueryKey(queryKey, payload));
      }
    },
    [getItemApiOptions, queryClient, updateCachedQueryKey]
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
          const queryKey = getItemApiOptions(id).issueApiOptions?.queryKey;
          if (queryKey) {
            queryClient.invalidateQueries({queryKey});
          }
        });
      }
    },
    [getItemApiOptions, queryClient]
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
