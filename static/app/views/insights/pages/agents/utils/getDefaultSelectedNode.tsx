import {
  getIsAiGenerationNode,
  getIsAiNode,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

export function getDefaultSelectedNode(nodes: AITraceSpanNode[]) {
  // Prefer generation spans (ai_client) as they produce assistant messages
  const firstGenerationSpan = nodes.find(getIsAiGenerationNode);
  if (firstGenerationSpan) {
    return firstGenerationSpan;
  }
  // Fall back to first AI span of any type
  const firstAiSpan = nodes.find(getIsAiNode);
  return firstAiSpan ?? nodes[0];
}
