import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';

import {getStylingSliceName} from '../../../traces/utils';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../traceGuards';

import type {TraceTree} from './traceTree';
import type {TraceTreeNode} from './traceTreeNode';

// Returns a list of segments from a grouping sequence that can be used to render a span bar chart
// It looks for gaps between spans and creates a segment for each gap. If there are no gaps, it
// merges the n and n+1 segments.
export function computeAutogroupedBarSegments(
  nodes: TraceTreeNode<TraceTree.NodeValue>[]
): [number, number][] {
  if (nodes.length === 0) {
    return [];
  }

  if (nodes.length === 1) {
    const space = nodes[0].space;
    if (!space) {
      throw new Error(
        'Autogrouped node child has no defined space. This should not happen.'
      );
    }
    return [space];
  }

  const first = nodes[0];

  if (!isSpanNode(first)) {
    throw new Error('Autogrouped node must have span children');
  }

  const segments: [number, number][] = [];

  let start = first.space[0];
  let end = first.space[0] + first.space[1];
  let i = 1;

  while (i < nodes.length) {
    const next = nodes[i];

    if (!isSpanNode(next)) {
      throw new Error('Autogrouped node must have span children');
    }

    if (next.space[0] > end) {
      segments.push([start, end - start]);
      start = next.space[0];
      end = next.space[0] + next.space[1];
      i++;
    } else {
      end = next.space[0] + next.space[1];
      i++;
    }
  }

  segments.push([start, end - start]);

  return segments;
}

export function makeTraceNodeBarColor(
  theme: Theme,
  node: TraceTreeNode<TraceTree.NodeValue>
): string {
  if (isTransactionNode(node)) {
    return pickBarColor(
      getStylingSliceName(node.value.project_slug, node.value.sdk_name) ??
        node.value['transaction.op']
    );
  }
  if (isSpanNode(node)) {
    return pickBarColor(node.value.op);
  }
  if (isAutogroupedNode(node)) {
    if (node.errors.size > 0) {
      return theme.red300;
    }
    return theme.blue300;
  }
  if (isMissingInstrumentationNode(node)) {
    return theme.gray300;
  }

  if (isTraceErrorNode(node)) {
    // Theme defines this as orange, yet everywhere in our product we show red for errors
    if (node.value.level === 'error' || node.value.level === 'fatal') {
      return theme.red300;
    }
    if (node.value.level) {
      return theme.level[node.value.level] ?? theme.red300;
    }
    return theme.red300;
  }
  return pickBarColor('default');
}
