import {useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {getUtcDateString} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

interface InputContent {
  text: string;
  type: string;
}

interface ConversationApiResponse {
  conversationId: string;
  duration: number;
  errors: number;
  flow: string[];
  llmCalls: number;
  timestamp: number;
  toolCalls: number;
  totalTokens: number;
  traceCount: number;
  traceIds: string[];
  firstInput?: InputContent[] | null;
  lastOutput?: string | null;
  totalCost?: number | null;
}

export interface Conversation {
  conversationId: string;
  duration: number;
  errors: number;
  firstInput: string | null;
  lastOutput: string | null;
  llmCalls: number;
  timestamp: number;
  toolCalls: number;
  totalCost: number | null;
  totalTokens: number;
  traceCount: number;
  traceIds: string[];
}

/**
 * Extracts a displayable text string from the firstInput array.
 * The firstInput field contains an array of content objects with type and text.
 */
function extractFirstInputText(
  firstInput: InputContent[] | null | undefined
): string | null {
  if (!firstInput || firstInput.length === 0) {
    return null;
  }
  // Find the first text content and return its text
  const textContent = firstInput.find(content => content.type === 'text');
  return textContent?.text ?? null;
}

/**
 * Transforms API response conversation to the frontend Conversation type.
 */
function transformConversation(conversation: ConversationApiResponse): Conversation {
  return {
    conversationId: conversation.conversationId,
    duration: conversation.duration,
    errors: conversation.errors,
    firstInput: extractFirstInputText(conversation.firstInput),
    lastOutput: conversation.lastOutput ?? null,
    llmCalls: conversation.llmCalls,
    timestamp: conversation.timestamp,
    toolCalls: conversation.toolCalls,
    totalCost: conversation.totalCost ?? null,
    totalTokens: conversation.totalTokens,
    traceCount: conversation.traceCount,
    traceIds: conversation.traceIds,
  };
}

export function useConversations() {
  const organization = useOrganization();
  const {cursor, setCursor} = useTableCursor();
  const pageFilters = usePageFilters();
  const [searchQuery] = useQueryState('query', parseAsString);

  const {start, end, period, utc} = pageFilters.selection.datetime;

  const {
    data: rawData,
    isLoading,
    error,
    getResponseHeader,
  } = useApiQuery<ConversationApiResponse[]>(
    [
      `/organizations/${organization.slug}/ai-conversations/`,
      {
        query: {
          cursor,
          query: searchQuery ?? undefined,
          project: pageFilters.selection.projects,
          environment: pageFilters.selection.environments,
          period,
          start: start instanceof Date ? getUtcDateString(start) : start,
          end: end instanceof Date ? getUtcDateString(end) : end,
          utc,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const pageLinks = getResponseHeader?.('Link');

  // Transform API response to frontend format
  const data: Conversation[] = useMemo(() => {
    if (!rawData) {
      return [];
    }

    return rawData.map(transformConversation);
  }, [rawData]);

  return {
    data,
    isLoading,
    error,
    pageLinks,
    setCursor,
  };
}
