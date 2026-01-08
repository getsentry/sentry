import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs';

export enum ConversationDrawerUrlParams {
  SELECTED_CONVERSATION = 'conversation',
  SELECTED_SPAN = 'conversationSpan',
  TRACE_IDS = 'conversationTraces',
}

export function useConversationDrawerQueryState() {
  return useQueryStates(
    {
      conversationId: parseAsString,
      spanId: parseAsString,
      traceIds: parseAsArrayOf(parseAsString),
    },
    {
      history: 'replace',
      urlKeys: {
        conversationId: ConversationDrawerUrlParams.SELECTED_CONVERSATION,
        spanId: ConversationDrawerUrlParams.SELECTED_SPAN,
        traceIds: ConversationDrawerUrlParams.TRACE_IDS,
      },
    }
  );
}
