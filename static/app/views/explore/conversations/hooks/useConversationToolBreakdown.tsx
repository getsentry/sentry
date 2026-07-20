import {useMemo} from 'react';

import {escapeDoubleQuotes} from 'sentry/utils';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getToolSpansFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {SpanFields} from 'sentry/views/insights/types';

export interface ConversationToolUsage {
  calls: number;
  duration: number;
  hasError: boolean;
  toolName: string;
}

interface UseConversationToolBreakdownOptions {
  conversationId: string;
  /** Gate the request so it only fires when the row is hovered (prefetch). */
  enabled: boolean;
}

/**
 * Aggregates the tool-execution spans of a single conversation into a per-tool
 * breakdown of call count and total duration. Backs the Tool Calls hover card
 * in the conversations table.
 */
export function useConversationToolBreakdown({
  conversationId,
  enabled,
}: UseConversationToolBreakdownOptions) {
  const {data, isLoading, error} = useSpans(
    {
      search: `${getToolSpansFilter()} ${SpanFields.GEN_AI_CONVERSATION_ID}:"${escapeDoubleQuotes(conversationId)}"`,
      fields: [
        'gen_ai.tool.name',
        'count(span.duration)',
        'sum(span.duration)',
        'count_if(span.status,equals,internal_error)',
        'count_if(span.status,equals,error)',
      ],
      sorts: [{field: 'count(span.duration)', kind: 'desc'}],
      limit: 50,
      enabled,
    },
    'api.conversations.tool-breakdown'
  );

  const toolUsage = useMemo<ConversationToolUsage[]>(
    () =>
      data
        .map(row => ({
          toolName: row['gen_ai.tool.name'],
          calls: Number(row['count(span.duration)'] ?? 0),
          duration: Number(row['sum(span.duration)'] ?? 0),
          hasError:
            Number(row['count_if(span.status,equals,internal_error)'] ?? 0) +
              Number(row['count_if(span.status,equals,error)'] ?? 0) >
            0,
        }))
        .filter(tool => tool.toolName),
    [data]
  );

  return {data: toolUsage, isLoading, error};
}
