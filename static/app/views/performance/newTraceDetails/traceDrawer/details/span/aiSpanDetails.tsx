import {useState} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {
  ConversationSpanDetail,
  type DetailTab,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {useAvgSpanDuration} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';

interface AiSpanDetailsProps {
  node: AITraceSpanNode;
  traceId: string;
}

export function AiSpanDetails({node, traceId}: AiSpanDetailsProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<DetailTab>('input');

  const eapSpan = isEAPSpanNode(node) ? node.value : undefined;
  const avgSpanDuration = useAvgSpanDuration(eapSpan, location);

  return (
    <ConversationSpanDetail
      node={node}
      traceId={traceId}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      avgDuration={avgSpanDuration ? avgSpanDuration / 1000 : undefined}
      embedded
    />
  );
}
