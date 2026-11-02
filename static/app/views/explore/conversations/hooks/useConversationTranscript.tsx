import {useEffect, useMemo} from 'react';
import {skipToken, useInfiniteQuery, type InfiniteData} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getConversationQueryOptions,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import type {ConversationMessage} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {hasBackendConversationTranscriptFeature} from 'sentry/views/explore/conversations/utils/features';

export const MAX_TRANSCRIPT_PAGES = 500;

export interface ConversationTranscriptResponse {
  complete: boolean;
  conversationId: string;
  sourceSpanCount: number;
  title: string | null;
  transcript: ConversationMessage[];
}

type TranscriptPages = InfiniteData<ApiResponse<ConversationTranscriptResponse>>;

export function getConversationTranscriptFromPages(data: TranscriptPages | undefined) {
  const first = data?.pages[0]?.json;
  if (!data || !first) {
    return;
  }
  return {
    title: first.title,
    transcript: data.pages.flatMap(page => page.json.transcript),
    complete: data.pages.at(-1)?.json.complete ?? false,
  };
}

export function getConversationTranscriptQueryOptions(
  organization: Organization,
  conversation: UseConversationsOptions,
  selection: PageFilters,
  enabled = true
) {
  const timelineOptions = getConversationQueryOptions(
    organization,
    conversation,
    selection
  );
  const {options} = parseQueryKey(timelineOptions.queryKey);
  const transcriptOptions = apiOptions.asInfinite<ConversationTranscriptResponse>()(
    '/organizations/$organizationIdOrSlug/agents/conversations/$conversationId/',
    {
      path:
        enabled && conversation.conversationId
          ? {
              organizationIdOrSlug: organization.slug,
              conversationId: conversation.conversationId,
            }
          : skipToken,
      query: {...options.query, view: 'transcript'},
      staleTime: Infinity,
    }
  );
  return {
    ...transcriptOptions,
    getNextPageParam: (
      lastPage: ApiResponse<ConversationTranscriptResponse>,
      pages: Array<ApiResponse<ConversationTranscriptResponse>>,
      lastPageParam: ParsedHeader | undefined,
      pageParams: Array<ParsedHeader | undefined>
    ) => {
      if (lastPage.json.complete) {
        return null;
      }
      const next = transcriptOptions.getNextPageParam(
        lastPage,
        pages,
        lastPageParam,
        pageParams
      );
      // A repeated cursor cannot make progress. Leave the transcript incomplete, never export it.
      return next && !pageParams.some(page => page?.cursor === next.cursor) ? next : null;
    },
  };
}

export function useConversationTranscript(
  conversation: UseConversationsOptions,
  enabled = true
) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const active = enabled && hasBackendConversationTranscriptFeature(organization);
  const query = useInfiniteQuery(
    getConversationTranscriptQueryOptions(organization, conversation, selection, active)
  );
  const pageCount = query.data?.pages.length ?? 0;
  const {hasNextPage, isFetching, isError, fetchNextPage} = query;
  const canFetchMore =
    active && hasNextPage && !isError && pageCount < MAX_TRANSCRIPT_PAGES;

  const nextAutoFetchPage = canFetchMore ? pageCount : null;
  useEffect(() => {
    if (nextAutoFetchPage !== null && !isFetching) {
      void fetchNextPage({cancelRefetch: false});
    }
  }, [nextAutoFetchPage, isFetching, fetchNextPage]);

  const data = useMemo(
    () => getConversationTranscriptFromPages(query.data),
    [query.data]
  );
  const incomplete = data !== undefined && !data.complete && !canFetchMore && active;
  return {
    data,
    isLoading: query.isLoading || canFetchMore,
    isError: query.isError || incomplete,
  };
}
