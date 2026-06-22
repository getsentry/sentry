import {useMemo} from 'react';

import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import type {SpanProperty} from 'sentry/views/insights/types';

export function useConversationAgents(): {
  agentsByConversation: Record<string, string[]>;
  isLoading: boolean;
} {
  const {data, isPending} = useSpans(
    {
      limit: 500,
      search: `has:gen_ai.conversation.id has:gen_ai.agent.name`,
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [
        'gen_ai.conversation.id' as SpanProperty,
        'gen_ai.agent.name' as SpanProperty,
        'count()' as SpanProperty,
      ],
    },
    'api.insights.conversations.get-agent-names-direct'
  );

  const agentsByConversation = useMemo(() => {
    const map: Record<string, string[]> = {};
    data?.forEach(row => {
      const r = row as Record<string, unknown>;
      const convId = r['gen_ai.conversation.id'] as string | undefined;
      const agentName = r['gen_ai.agent.name'] as string | undefined;
      if (convId && agentName) {
        if (!map[convId]) {
          map[convId] = [];
        }
        if (!map[convId].includes(agentName)) {
          map[convId].push(agentName);
        }
      }
    });
    return map;
  }, [data]);

  return {agentsByConversation, isLoading: isPending};
}
