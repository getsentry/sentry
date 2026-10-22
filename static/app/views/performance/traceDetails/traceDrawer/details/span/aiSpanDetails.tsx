import {useState} from 'react';

import {
  ConversationSpanDetail,
  type DetailTab,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {getIsExecuteToolNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {useSpanAverages} from 'sentry/views/performance/traceDetails/traceDrawer/details/span';
import {isEAPSpanNode} from 'sentry/views/performance/traceDetails/traceGuards';

interface AiSpanDetailsProps {
  node: AITraceSpanNode;
  traceId: string;
}

export function AiSpanDetails({node, traceId}: AiSpanDetailsProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('input');

  const eapSpan = isEAPSpanNode(node) ? node.value : undefined;
  const {avgDuration, avgToolOutputSize} = useSpanAverages(
    eapSpan,
    getIsExecuteToolNode(node)
  );

  return (
    <ConversationSpanDetail
      node={node}
      traceId={traceId}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      avgDuration={avgDuration ? avgDuration / 1000 : undefined}
      avgToolOutputSize={avgToolOutputSize}
      embedded
    />
  );
}
