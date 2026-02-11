import {
  getIsAiGenerationNode,
  getIsAiNode,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

export function getDefaultSelectedNode(nodes: AITraceSpanNode[]) {
  const firstGenerationSpan = nodes.find(getIsAiGenerationNode);
  if (firstGenerationSpan) {
    return firstGenerationSpan;
  }
  const firstAiSpan = nodes.find(getIsAiNode);
  return firstAiSpan ?? nodes[0];
}
