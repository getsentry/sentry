import {useEffect, useState} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ConversationSpanDetail,
  type DetailTab,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {getGenAiOpType} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {traceAnalytics} from 'sentry/views/performance/traceDetails/traceAnalytics';
import {useAvgSpanDuration} from 'sentry/views/performance/traceDetails/traceDrawer/details/span';
import {isEAPSpanNode} from 'sentry/views/performance/traceDetails/traceGuards';

interface AiSpanDetailsProps {
  node: AITraceSpanNode;
  traceId: string;
}

export function AiSpanDetails({node, traceId}: AiSpanDetailsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const [activeTab, setActiveTab] = useState<DetailTab>('input');
  useEffect(() => {
    traceAnalytics.trackGenAISpanDetailsViewed(organization, getGenAiOpType(node)!);
  }, [node, organization]);

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
