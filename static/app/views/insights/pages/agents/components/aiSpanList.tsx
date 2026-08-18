import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

export function getNodeTimeBounds(node: AITraceSpanNode | AITraceSpanNode[]) {
  let startTime = 0;
  let endTime = 0;

  if (Array.isArray(node)) {
    const totalStartAndEndTime = node.reduce(
      (acc, n) => {
        const bounds = getNodeTimeBounds(n);
        return {
          startTime: Math.min(acc.startTime, bounds.startTime),
          endTime: Math.max(acc.endTime, bounds.endTime),
        };
      },
      {startTime: Infinity, endTime: 0}
    );
    startTime = totalStartAndEndTime.startTime;
    endTime = totalStartAndEndTime.endTime;
  } else {
    if (!node.startTimestamp || !node.endTimestamp) {
      return {startTime: 0, endTime: 0, duration: 0};
    }

    startTime = node.startTimestamp;
    endTime = node.endTimestamp;
  }

  if (endTime === 0) {
    return {startTime: 0, endTime: 0, duration: 0};
  }

  return {
    startTime,
    endTime,
    duration: endTime - startTime,
  };
}
