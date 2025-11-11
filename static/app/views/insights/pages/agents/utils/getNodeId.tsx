import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';

export function getNodeId(node: AITraceSpanNode): string {
  if (isEAPSpanNode(node)) {
    return node.metadata.event_id as string;
  }
  if (isTransactionNode(node)) {
    return node.value.event_id;
  }

  if (isSpanNode(node)) {
    return node.value.span_id;
  }

  // We should never reach this point as AITraceSpanNode only contains the above node types
  throw new Error('Invalid node type');
}
