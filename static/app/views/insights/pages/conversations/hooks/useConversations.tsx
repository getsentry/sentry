import {useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import {getUtcDateString} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

interface ConversationApiResponse extends Omit<Conversation, 'firstInput'> {
  firstInput?: Array<{text: string; type: string}> | string | null;
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

  const data = useMemo(() => {
    return (rawData ?? []).map((conversation): Conversation => {
      let firstInput: string | null = null;
      if (typeof conversation.firstInput === 'string') {
        firstInput = conversation.firstInput;
      } else if (Array.isArray(conversation.firstInput)) {
        firstInput =
          conversation.firstInput.find(content => content.type === 'text')?.text ?? null;
      }
      return {...conversation, firstInput};
    });
  }, [rawData]);

  return {
    data,
    isLoading,
    error,
    pageLinks,
    setCursor,
  };
}
