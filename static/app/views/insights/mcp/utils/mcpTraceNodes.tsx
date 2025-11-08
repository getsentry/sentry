import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

export function getIsMCPNode(node: BaseNode) {
  if (!isTransactionNode(node) && !isSpanNode(node) && !isEAPSpanNode(node)) {
    return false;
  }

  const op = isTransactionNode(node) ? node.value['transaction.op'] : node.value.op;
  return op?.startsWith('mcp.');
}
