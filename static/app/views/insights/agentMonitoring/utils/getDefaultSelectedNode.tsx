import {getIsAiNode} from 'sentry/views/insights/agentMonitoring/utils/highlightedSpanAttributes';
import type {AITraceSpanNode} from 'sentry/views/insights/agentMonitoring/utils/types';

export function getDefaultSelectedNode(nodes: AITraceSpanNode[]) {
  const firstAiSpan = nodes.find(getIsAiNode);
  return firstAiSpan ?? nodes[0];
}
