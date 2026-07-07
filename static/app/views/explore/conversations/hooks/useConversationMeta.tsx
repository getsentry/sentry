import {skipToken, useQuery} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ConversationUser} from 'sentry/views/explore/conversations/hooks/useConversations';

export interface ConversationToolSummary {
  calls: number;
  duration: number;
  hasError: boolean;
  name: string;
}

/**
 * Server-computed summary for a single conversation. Mirrors the numbers the
 * conversations list and details endpoints derive, so the header and the table
 * never disagree.
 */
export interface ConversationMeta {
  errors: number;
  inputTokens: number;
  llmCalls: number;
  outputTokens: number;
  toolCalls: number;
  tools: ConversationToolSummary[];
  totalCost: number;
  totalTokens: number;
  traceIds: string[];
  user: ConversationUser | null;
}

/**
 * Fetches the server-computed summary for a conversation. The endpoint probes
 * progressively wider time windows to locate the conversation, so no explicit
 * range is passed here.
 */
export function useConversationMeta({conversationId}: {conversationId: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const project =
    selection.projects.length > 0 ? selection.projects : [ALL_ACCESS_PROJECTS];

  return useQuery(
    apiOptions.as<ConversationMeta>()(
      '/organizations/$organizationIdOrSlug/ai-conversations/$conversationId/meta/',
      {
        path: conversationId
          ? {organizationIdOrSlug: organization.slug, conversationId}
          : skipToken,
        query: {project},
        staleTime: 0,
      }
    )
  );
}
