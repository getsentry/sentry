import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export interface ConversationUser {
  email: string | null;
  id: string | null;
  ip_address: string | null;
  username: string | null;
}

interface ConversationApiResponse extends Omit<Conversation, 'firstInput'> {
  endTimestamp?: number;
  firstInput?: Array<{text: string; type: string}> | string | null;
}

export interface Conversation {
  conversationId: string;
  duration: number;
  endTimestamp: number;
  errors: number;
  firstInput: string | null;
  lastOutput: string | null;
  llmCalls: number;
  startTimestamp: number;
  toolCalls: number;
  totalCost: number | null;
  totalTokens: number;
  traceCount: number;
  traceIds: string[];
  user: ConversationUser | null;
}

export function useConversations() {
  const organization = useOrganization();
  const {cursor, setCursor} = useTableCursor();
  const pageFilters = usePageFilters();
  const combinedQuery = useCombinedQuery();

  const {
    data: rawData,
    isLoading,
    error,
    getResponseHeader,
  } = useApiQuery<ConversationApiResponse[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/ai-conversations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          cursor,
          query: combinedQuery,
          project: pageFilters.selection.projects,
          environment: pageFilters.selection.environments,
          ...normalizeDateTimeParams(pageFilters.selection.datetime),
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
      const {endTimestamp: _, firstInput: rawFirstInput, ...rest} = conversation;
      let firstInput: string | null = null;
      if (typeof rawFirstInput === 'string') {
        firstInput = rawFirstInput;
      } else if (Array.isArray(rawFirstInput)) {
        firstInput = rawFirstInput.find(content => content.type === 'text')?.text ?? null;
      }
      return {...rest, firstInput};
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
