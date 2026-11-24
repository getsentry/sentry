import {getIsAiGenerationNode, getIsAiNode} from './aiTraceNodes';
import type {AITraceSpanNode} from './types';

export function getDefaultSelectedNode(nodes: AITraceSpanNode[]) {
  const firstGenerationSpan = nodes.find(getIsAiGenerationNode);
  if (firstGenerationSpan) {
    return firstGenerationSpan;
  }
  const firstAiSpan = nodes.find(getIsAiNode);
  return firstAiSpan ?? nodes[0];
}
