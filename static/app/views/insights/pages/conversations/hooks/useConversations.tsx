import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export interface ConversationUser {
  email: string | null;
  id: string | null;
  ip_address: string | null;
  username: string | null;
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
  toolErrors: number;
  toolNames: string[];
  totalCost: number | null;
  totalTokens: number;
  traceCount: number;
  traceIds: string[];
  user: ConversationUser | null;
}

interface ConversationApiResponse extends Omit<
  Conversation,
  'firstInput' | 'lastOutput'
> {
  firstInput?: Array<{text: string; type: string}> | string | null;
  lastOutput?: Array<{text: string; type: string}> | string | null;
}

export function useConversations() {
  const organization = useOrganization();
  const {cursor, setCursor} = useTableCursor();
  const pageFilters = usePageFilters();
  const combinedQuery = useCombinedQuery();

  const {
    data: response,
    isLoading,
    error,
  } = useQuery({
    ...apiOptions.as<ConversationApiResponse[]>()(
      '/organizations/$organizationIdOrSlug/ai-conversations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          cursor,
          query: combinedQuery,
          project: pageFilters.selection.projects,
          environment: pageFilters.selection.environments,
          ...normalizeDateTimeParams(pageFilters.selection.datetime),
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });

  const pageLinks = response?.headers.Link;

  const data = useMemo(() => {
    return (response?.json ?? [])
      .map(
        ({
          firstInput: rawFirstInput,
          lastOutput: rawLastOutput,
          ...rest
        }): Conversation => {
          const firstInput =
            typeof rawFirstInput === 'string'
              ? rawFirstInput
              : (rawFirstInput?.find(content => content.type === 'text')?.text ?? null);
          const lastOutput =
            typeof rawLastOutput === 'string'
              ? rawLastOutput
              : (rawLastOutput?.find(content => content.type === 'text')?.text ?? null);
          return {...rest, firstInput, lastOutput};
        }
      )
      .sort((a, b) => b.endTimestamp - a.endTimestamp);
  }, [response?.json]);

  return {
    data,
    isLoading,
    error,
    pageLinks,
    setCursor,
  };
}
