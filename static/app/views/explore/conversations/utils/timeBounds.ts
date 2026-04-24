import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

export function getTimeBoundsFromNodes(nodes: AITraceSpanNode[]): {
  endTimestamp: number | undefined;
  startTimestamp: number | undefined;
} {
  if (nodes.length === 0) {
    return {startTimestamp: undefined, endTimestamp: undefined};
  }

  let min = Infinity;
  let max = -Infinity;

  for (const node of nodes) {
    if (node.startTimestamp !== undefined && node.startTimestamp < min) {
      min = node.startTimestamp;
    }
    if (node.endTimestamp !== undefined && node.endTimestamp > max) {
      max = node.endTimestamp;
    }
  }

  // Node timestamps are in seconds; convert to milliseconds for the conversation hook
  return {
    startTimestamp: min === Infinity ? undefined : min * 1e3,
    endTimestamp: max === -Infinity ? undefined : max * 1e3,
  };
}
