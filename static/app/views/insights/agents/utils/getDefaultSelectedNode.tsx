import {getIsAiNode} from 'sentry/views/insights/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/agents/utils/types';

export function getDefaultSelectedNode(nodes: AITraceSpanNode[]) {
  const firstAiSpan = nodes.find(getIsAiNode);
  return firstAiSpan ?? nodes[0];
}
