import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';

export function getIsMCPNode(node: BaseNode) {
  return node.op?.startsWith('mcp.') ?? false;
}
