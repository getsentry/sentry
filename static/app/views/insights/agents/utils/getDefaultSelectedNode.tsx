import type {AITraceSpanNode} from 'sentry/views/insights/agents/utils/types';

import {getIsAiSpan} from './query';

export function getDefaultSelectedNode(nodes: AITraceSpanNode[]) {
  const firstAiSpan = nodes.find(node => getIsAiSpan({op: node.op}));
  return firstAiSpan ?? nodes[0];
}
