import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

export interface TraceBounds {
  duration: number;
  endTime: number;
  startTime: number;
}

export interface CompressedTimeBounds extends TraceBounds {
  compressedStartByNodeId: Map<string, number>;
}

const MAX_GAP_SECONDS = 30;
const COMPRESSED_GAP_SECONDS = 1;

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

/**
 * Compresses large time gaps between spans to make the timeline more readable.
 * Gaps larger than MAX_GAP_SECONDS are compressed to COMPRESSED_GAP_SECONDS.
 *
 * This function handles nested/overlapping spans by tracking "segments" - continuous
 * time ranges where spans are active. When a gap is detected between segments,
 * it's compressed if larger than MAX_GAP_SECONDS.
 *
 * Returns a Map of node IDs to their compressed start times, which allows O(1)
 * lookup when rendering each span's position on the timeline.
 */
export function getCompressedTimeBounds(nodes: AITraceSpanNode[]): CompressedTimeBounds {
  const emptyResult: CompressedTimeBounds = {
    startTime: 0,
    endTime: 0,
    duration: 0,
    compressedStartByNodeId: new Map(),
  };

  if (nodes.length === 0) {
    return emptyResult;
  }

  const sortedNodes = [...nodes]
    .filter(n => n.startTimestamp && n.endTimestamp)
    .sort((a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0));

  if (sortedNodes.length === 0) {
    return emptyResult;
  }

  const compressedStartByNodeId = new Map<string, number>();

  // Track current segment bounds - a segment is a continuous time range
  // where at least one span is active (handles overlapping/nested spans)
  const firstNode = sortedNodes[0]!;
  let segmentRealStart = firstNode.startTimestamp!;
  let segmentRealEnd = firstNode.endTimestamp!;
  let segmentCompressedStart = 0;

  compressedStartByNodeId.set(firstNode.id, 0);

  for (let i = 1; i < sortedNodes.length; i++) {
    const node = sortedNodes[i]!;
    const nodeStart = node.startTimestamp!;
    const nodeEnd = node.endTimestamp!;

    if (nodeStart > segmentRealEnd) {
      // Gap detected - finish current segment and start new one
      const gap = nodeStart - segmentRealEnd;
      const compressedGap = gap > MAX_GAP_SECONDS ? COMPRESSED_GAP_SECONDS : gap;
      const segmentDuration = segmentRealEnd - segmentRealStart;

      // Advance compressed time by segment duration + gap
      segmentCompressedStart += segmentDuration + compressedGap;

      // Start new segment
      segmentRealStart = nodeStart;
      segmentRealEnd = nodeEnd;
    } else {
      // Overlapping/nested span - extend current segment if needed
      segmentRealEnd = Math.max(segmentRealEnd, nodeEnd);
    }

    // Calculate this node's compressed start relative to the current segment
    const offsetInSegment = nodeStart - segmentRealStart;
    compressedStartByNodeId.set(node.id, segmentCompressedStart + offsetInSegment);
  }

  // Total duration is the compressed start of last segment + its duration
  const totalDuration = segmentCompressedStart + (segmentRealEnd - segmentRealStart);

  return {
    startTime: 0,
    endTime: totalDuration,
    duration: totalDuration,
    compressedStartByNodeId,
  };
}

export function calculateRelativeTiming(
  node: AITraceSpanNode,
  traceBounds: TraceBounds,
  compressedStartByNodeId?: Map<string, number>
): {leftPercent: number; widthPercent: number} {
  if (!node.value) {
    return {leftPercent: 0, widthPercent: 0};
  }

  let startTime: number, endTime: number;

  if (node.startTimestamp && node.endTimestamp) {
    startTime = node.startTimestamp;
    endTime = node.endTimestamp;
  } else {
    return {leftPercent: 0, widthPercent: 0};
  }

  if (traceBounds.duration === 0) {
    return {leftPercent: 0, widthPercent: 0};
  }

  // Look up the pre-computed compressed start time for this node.
  // The span duration stays the same - only gaps between spans are compressed.
  const compressedStart = compressedStartByNodeId?.get(node.id);
  const effectiveStart =
    compressedStart === undefined ? startTime - traceBounds.startTime : compressedStart;
  const effectiveEnd =
    compressedStart === undefined
      ? endTime - traceBounds.startTime
      : compressedStart + (endTime - startTime);

  const relativeStart = Math.max(0, effectiveStart / traceBounds.duration) * 100;
  const spanDuration = ((effectiveEnd - effectiveStart) / traceBounds.duration) * 100;

  const minWidth = 2;
  const adjustedWidth = Math.max(spanDuration, minWidth);

  const maxAllowedStart = 100 - adjustedWidth;
  const adjustedStart = Math.min(relativeStart, maxAllowedStart);

  return {leftPercent: adjustedStart, widthPercent: adjustedWidth};
}
