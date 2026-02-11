import {parseAsInteger, parseAsString, useQueryStates} from 'nuqs';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/conversations/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

export enum ConversationDrawerUrlParams {
  SELECTED_CONVERSATION = 'conversation',
  SELECTED_SPAN = 'conversationSpan',
  START_TIMESTAMP = 'conversationStart',
  END_TIMESTAMP = 'conversationEnd',
  FOCUSED_TOOL = 'conversationTool',
}

export function useConversationDrawerQueryState() {
  return useQueryStates(
    {
      conversationId: parseAsString,
      spanId: parseAsString,
      startTimestamp: parseAsInteger,
      endTimestamp: parseAsInteger,
      focusedTool: parseAsString,
    },
    {
      history: 'replace',
      urlKeys: {
        conversationId: ConversationDrawerUrlParams.SELECTED_CONVERSATION,
        spanId: ConversationDrawerUrlParams.SELECTED_SPAN,
        startTimestamp: ConversationDrawerUrlParams.START_TIMESTAMP,
        endTimestamp: ConversationDrawerUrlParams.END_TIMESTAMP,
        focusedTool: ConversationDrawerUrlParams.FOCUSED_TOOL,
      },
    }
  );
}

export function getConversationsUrl(
  organizationSlug: string,
  conversationId: number | string
): string {
  const basePath = `/organizations/${organizationSlug}/${DOMAIN_VIEW_BASE_URL}/${CONVERSATIONS_LANDING_SUB_PATH}/`;
  const searchQuery = encodeURIComponent(
    `has:user.email gen_ai.conversation.id:${conversationId}`
  );
  const queryParams = `?query=${searchQuery}&${ConversationDrawerUrlParams.SELECTED_CONVERSATION}=${conversationId}`;
  return `${window.location.origin}${normalizeUrl(basePath)}${queryParams}`;
}
