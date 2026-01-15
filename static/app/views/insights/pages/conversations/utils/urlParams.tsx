import {parseAsString, useQueryStates} from 'nuqs';

export enum ConversationDrawerUrlParams {
  SELECTED_CONVERSATION = 'conversation',
  SELECTED_SPAN = 'conversationSpan',
}

export function useConversationDrawerQueryState() {
  return useQueryStates(
    {
      conversationId: parseAsString,
      spanId: parseAsString,
    },
    {
      history: 'replace',
      urlKeys: {
        conversationId: ConversationDrawerUrlParams.SELECTED_CONVERSATION,
        spanId: ConversationDrawerUrlParams.SELECTED_SPAN,
      },
    }
  );
}
