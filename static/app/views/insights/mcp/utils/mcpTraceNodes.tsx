import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

export function getIsMCPNode(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
    return false;
  }

  const op = isTransactionNode(node) ? node.value['transaction.op'] : node.value.op;
  return op?.startsWith('mcp.');
}
