import {useMemo} from 'react';

import {useOrganization} from 'sentry/utils/useOrganization';
import {useAITrace} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {getStringAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {hasGenAiConversationsFeature} from 'sentry/views/insights/pages/agents/utils/features';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceAiConversations} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiConversations';
import {TraceAiSpans} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiSpans';

function getConversationIds(nodes: AITraceSpanNode[]): string[] {
  const ids = new Set<string>();
  for (const node of nodes) {
    const convId = getStringAttr(node, SpanFields.GEN_AI_CONVERSATION_ID);
    if (convId) {
      ids.add(convId);
    }
  }
  return Array.from(ids);
}

export function TraceAiTab({traceSlug}: {traceSlug: string}) {
  const organization = useOrganization();
  const {nodes, isLoading, error} = useAITrace(traceSlug);

  const conversationIds = useMemo(() => getConversationIds(nodes), [nodes]);

  const hasConversations =
    hasGenAiConversationsFeature(organization) && conversationIds.length > 0;

  if (hasConversations) {
    return (
      <TraceAiConversations
        conversationIds={conversationIds}
        allAiNodes={nodes}
        traceSlug={traceSlug}
      />
    );
  }

  return (
    <TraceAiSpans
      traceSlug={traceSlug}
      nodes={nodes}
      isLoading={isLoading}
      error={error}
    />
  );
}
