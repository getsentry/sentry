import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

export function getIsMCPNode(node: BaseNode) {
  const name = node.value && 'name' in node.value ? node.value.name! : undefined;
  return name?.startsWith('mcp.') ?? false;
}
