import {skipToken, useQuery} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getConversationQueryOptions,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import type {ConversationMessage} from 'sentry/views/explore/conversations/utils/conversationMessages';

export interface ConversationTranscriptResponse {
  complete: boolean;
  conversationId: string;
  sourceSpanCount: number;
  title: string | null;
  transcript: ConversationMessage[];
}

export function useConversationTranscriptSource() {
  const organization = useOrganization();
  const available = organization.features.includes(
    'gen-ai-conversations-backend-transcript'
  );
  const [preferredSource, setSource] = useQueryState(
    'transcriptSource',
    parseAsStringLiteral(['frontend', 'backend'] as const).withDefault('backend')
  );
  return {
    available,
    source: available ? preferredSource : ('frontend' as const),
    setSource,
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
  return apiOptions.as<ConversationTranscriptResponse>()(
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
}

export function useConversationTranscript(conversation: UseConversationsOptions) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const source = useConversationTranscriptSource();
  const query = useQuery(
    getConversationTranscriptQueryOptions(
      organization,
      conversation,
      selection,
      source.source === 'backend'
    )
  );
  return {
    ...source,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
