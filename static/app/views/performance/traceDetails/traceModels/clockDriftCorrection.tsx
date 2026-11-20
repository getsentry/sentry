import type {Organization} from 'sentry/types/organization';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';
import {isEAPSpanNode} from 'sentry/views/performance/traceDetails/traceGuards';

import type {BaseNode} from './traceTreeNode/baseNode';
import type {EapSpanNode} from './traceTreeNode/eapSpanNode';

/**
 * Clock drift smaller than this is not corrected. A few milliseconds of overlap are invisible at
 * normal zoom levels, and are within what browsers' coarsened timers can produce on their own, so
 * correcting and flagging them would mostly add noise.
 */
export const MIN_CLOCK_DRIFT_CORRECTION_MS = 10;

/**
 * Clock drift correction is only available to organizations with the feature flag. Without it, the
 * correction is never applied, whatever the stored preference says.
 */
export function hasClockDriftCorrectionFeature(
  organization: Organization | null
): boolean {
  return (
    organization?.features.includes('trace-waterfall-clock-drift-correction') ?? false
  );
}

/**
 * Formats a signed offset, e.g. `+312.00ms` or `−1.42s`.
 */
export function formatClockDriftOffset(offsetMs: number): string {
  const sign = offsetMs < 0 ? '−' : '+';
  return `${sign}${formatTraceDuration(Math.abs(offsetMs))}`;
}

export type ClockDriftCorrection = {
  /**
   * How far the server subtree was moved, in milliseconds. Positive values move it later.
   */
  offsetMs: number;
};

type ClientServerPair = {client: EapSpanNode; server: EapSpanNode};

/**
 * A server span continuing a trace from a client span in another process. Their timestamps come
 * from different clocks, so they can disagree.
 */
function isClientServerPair(client: EapSpanNode, server: EapSpanNode): boolean {
  if (!client.op?.startsWith('http.client') || !server.op?.startsWith('http.server')) {
    return false;
  }

  // The server span starting a new segment is what tells us the request left the client's
  // process. We can't rely on the project or SDK: full-stack frameworks like Next.js report both
  // sides under the same project and SDK name.
  return server.value.is_transaction;
}

function getSegment(node: EapSpanNode): BaseNode {
  if (node.value.is_transaction) {
    return node;
  }
  // Without a segment, the span is its own group.
  return node.findParentEapTransaction() ?? node;
}

function findClientServerPairs(root: BaseNode): ClientServerPair[] {
  const pairs: ClientServerPair[] = [];

  root.forEachChild(node => {
    if (!isEAPSpanNode(node)) {
      return;
    }
    for (const child of node.children) {
      if (isEAPSpanNode(child) && isClientServerPair(node, child)) {
        pairs.push({client: node, server: child});
      }
    }
  });

  return pairs;
}

/**
 * Returns the range of shifts (in ms) that would place the server span inside the client span,
 * or null if the server span is longer than the client span. A longer server span cannot be
 * explained by clock drift (e.g. streaming responses or work after an aborted request), so we
 * leave it alone.
 */
export function getAlignmentRange(
  clientSpace: [number, number],
  serverSpace: [number, number]
): [min: number, max: number] | null {
  const [clientStart, clientDuration] = clientSpace;
  const [serverStart, serverDuration] = serverSpace;

  const min = clientStart - serverStart;
  const max = clientStart + clientDuration - (serverStart + serverDuration);

  return min <= max ? [min, max] : null;
}

/**
 * Picks the smallest shift within the range. We don't center the server span, because the
 * request leg (incl. connection setup and CORS preflights) is usually much longer than the
 * response leg, so centering would distort more than it fixes.
 */
export function getSmallestShift([min, max]: [number, number]): number {
  if (min > 0) {
    return min;
  }
  if (max < 0) {
    return max;
  }
  return 0;
}

/**
 * Whether the shift lies within the range, give or take {@link MIN_CLOCK_DRIFT_CORRECTION_MS}.
 * Requests whose ranges miss each other by that much still count as agreeing on a shift: their
 * timestamps come from timers with limited precision, so exact agreement is too strict.
 */
function isWithinRange(range: [number, number], shift: number): boolean {
  const tolerance = MIN_CLOCK_DRIFT_CORRECTION_MS;
  return range[0] - tolerance <= shift && shift <= range[1] + tolerance;
}

/**
 * All requests made from the same process share one clock, so clock drift moves all of them by the
 * same amount. We look for the shift that most requests agree on, and only correct the requests
 * that agree with it. A request that disagrees is misaligned for another reason (e.g. a retry or a
 * reused trace header), which shifting would only hide.
 *
 * If there is no strict majority, the requests contradict each other and we can't tell which ones
 * are off, so we correct none of them.
 */
export function getClockDriftShifts(
  ranges: Array<[number, number] | null>
): Array<number | null> {
  const validRanges = ranges.filter((range): range is [number, number] => range !== null);
  if (validRanges.length === 0) {
    return ranges.map(() => null);
  }

  // The best shift is either 0 or at the edge of a range, so these are the only candidates to check
  const candidates = [0];
  for (const [min, max] of validRanges) {
    candidates.push(
      min - MIN_CLOCK_DRIFT_CORRECTION_MS,
      max + MIN_CLOCK_DRIFT_CORRECTION_MS
    );
  }

  let consensus = 0;
  let consensusCount = 0;
  for (const candidate of candidates) {
    const count = validRanges.filter(range => isWithinRange(range, candidate)).length;
    if (
      count > consensusCount ||
      (count === consensusCount && Math.abs(candidate) < Math.abs(consensus))
    ) {
      consensus = candidate;
      consensusCount = count;
    }
  }

  if (consensusCount * 2 <= validRanges.length) {
    return ranges.map(() => null);
  }

  const agrees = (range: [number, number] | null): range is [number, number] =>
    range !== null && isWithinRange(range, consensus);

  // Use the smallest shift that fits all agreeing requests exactly. If they only agree within the
  // tolerance, split the difference so no request is off by more than the others.
  let min = Number.NEGATIVE_INFINITY;
  let max = Number.POSITIVE_INFINITY;
  for (const range of ranges) {
    if (agrees(range)) {
      min = Math.max(min, range[0]);
      max = Math.min(max, range[1]);
    }
  }
  const shift = min <= max ? getSmallestShift([min, max]) : (min + max) / 2;

  return ranges.map(range => (agrees(range) ? shift : null));
}

function shiftSubtree(server: BaseNode, offsetMs: number): void {
  const shift = (node: BaseNode) => {
    node.space = [node.space[0] + offsetMs, node.space[1]];
    node.clockDriftOffsetMs += offsetMs;
  };

  shift(server);
  server.forEachChild(shift);
  server.clockDriftCorrection = {offsetMs};
}

/**
 * Moves server subtrees into the client spans that made the requests, if the clocks of both
 * sides disagree. Only node spaces change, the original timestamps stay intact.
 *
 * Must run before autogrouping and missing instrumentation detection, as these derive their
 * spaces from the spans.
 *
 * Returns the number of server subtrees that were moved.
 */
export function applyClockDriftCorrection(root: BaseNode): number {
  // Requests are grouped by the segment they were made from. A segment always runs in a single
  // process, so all its requests share one clock. A project or SDK does not: a backend service runs
  // on many hosts, each with its own clock.
  const groups = new Map<BaseNode, ClientServerPair[]>();

  for (const pair of findClientServerPairs(root)) {
    const key = getSegment(pair.client);
    const group = groups.get(key);
    if (group) {
      group.push(pair);
    } else {
      groups.set(key, [pair]);
    }
  }

  let correctedCount = 0;

  // Groups are ordered by their first pair in depth-first order, so a client further up the tree
  // is corrected before the services it calls. Ranges are computed per group, after the groups
  // before it were shifted.
  for (const pairs of groups.values()) {
    const ranges = pairs.map(({client, server}) =>
      getAlignmentRange(client.space, server.space)
    );
    const shifts = getClockDriftShifts(ranges);

    for (const [index, {server}] of pairs.entries()) {
      const shift = shifts[index] ?? 0;
      if (Math.abs(shift) < MIN_CLOCK_DRIFT_CORRECTION_MS) {
        continue;
      }
      shiftSubtree(server, shift);
      correctedCount++;
    }
  }

  return correctedCount;
}

/**
 * Restores the original spaces of all nodes moved by {@link applyClockDriftCorrection}.
 */
export function removeClockDriftCorrection(root: BaseNode): void {
  const restore = (node: BaseNode) => {
    node.clockDriftCorrection = null;
    if (node.clockDriftOffsetMs !== 0) {
      node.space = [node.space[0] - node.clockDriftOffsetMs, node.space[1]];
      node.clockDriftOffsetMs = 0;
    }
  };

  restore(root);
  root.forEachChild(restore);
}

export function collectClockDriftCorrections(root: BaseNode): BaseNode[] {
  const corrected: BaseNode[] = [];
  root.forEachChild(node => {
    if (node.clockDriftCorrection) {
      corrected.push(node);
    }
  });
  return corrected;
}
