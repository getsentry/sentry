import {useMemo} from 'react';

import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getToolSpansFilter} from 'sentry/views/insights/pages/agents/utils/query';
import type {SpanProperty} from 'sentry/views/insights/types';

export interface ToolStat {
  avgDuration: number;
  calls: number;
  name: string;
  totalDuration: number;
}

export function useConversationToolStats(): {
  isLoading: boolean;
  toolStatsByConversation: Record<string, ToolStat[]>;
} {
  const query = `has:gen_ai.conversation.id ${getToolSpansFilter()} has:gen_ai.tool.name`;

  const {data, isPending} = useSpans(
    {
      limit: 1000,
      search: query,
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [
        'gen_ai.conversation.id' as SpanProperty,
        'gen_ai.tool.name' as SpanProperty,
        'count()' as SpanProperty,
        'avg(span.duration)' as SpanProperty,
        'sum(span.duration)' as SpanProperty,
      ],
    },
    'api.insights.conversations.get-tool-stats'
  );

  const toolStatsByConversation = useMemo(() => {
    const map: Record<string, ToolStat[]> = {};
    data?.forEach(row => {
      const r = row as Record<string, unknown>;
      const convId = r['gen_ai.conversation.id'] as string | undefined;
      const toolName = r['gen_ai.tool.name'] as string | undefined;
      if (!convId || !toolName) {
        return;
      }
      if (!map[convId]) {
        map[convId] = [];
      }
      map[convId].push({
        name: toolName,
        calls: (r['count()'] as number) ?? 0,
        avgDuration: (r['avg(span.duration)'] as number) ?? 0,
        totalDuration: (r['sum(span.duration)'] as number) ?? 0,
      });
    });
    return map;
  }, [data]);

  return {toolStatsByConversation, isLoading: isPending};
}
