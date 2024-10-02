import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';

import {getStylingSliceName} from '../../../traces/utils';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../traceGuards';

import {MissingInstrumentationNode} from './missingInstrumentationNode';
import {ParentAutogroupNode} from './parentAutogroupNode';
import {SiblingAutogroupNode} from './siblingAutogroupNode';
import type {TraceTree} from './traceTree';
import {TraceTreeNode} from './traceTreeNode';

export function cloneTraceTreeNode(
  node:
    | TraceTreeNode<any>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | MissingInstrumentationNode
): TraceTreeNode<any> {
  let cloned:
    | TraceTreeNode<any>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | MissingInstrumentationNode;

  if (isParentAutogroupedNode(node)) {
    cloned = new ParentAutogroupNode(
      node.parent,
      node.value,
      node.metadata,
      node.head,
      node.tail
    );
    (cloned as ParentAutogroupNode).groupCount = node.groupCount;
  } else if (isSiblingAutogroupedNode(node)) {
    cloned = new SiblingAutogroupNode(node.parent, node.value, node.metadata);
    (cloned as SiblingAutogroupNode).groupCount = node.groupCount;
  } else if (isMissingInstrumentationNode(node)) {
    cloned = new MissingInstrumentationNode(
      node.parent!,
      node.value,
      node.metadata,
      node.previous,
      node.next
    );
  } else {
    cloned = new TraceTreeNode(node.parent, node.value, node.metadata);
  }

  if (!cloneTraceTreeNode) {
    throw new Error('Clone is not implemented');
  }

  cloned.expanded = node.expanded;
  cloned.zoomedIn = node.zoomedIn;
  cloned.canFetch = node.canFetch;
  cloned.fetchStatus = node.fetchStatus;
  cloned.space = node.space;
  cloned.metadata = node.metadata;

  if (isParentAutogroupedNode(cloned)) {
    cloned.head = cloneTraceTreeNode(cloned.head);
    cloned.tail = cloneTraceTreeNode(cloned.tail);
    cloned.head.parent = cloned;

    // If the node is not expanded, the parent of the tail points to the
    // autogrouped cloned. If the node is expanded, the parent of the children
    // of the tail points to the autogrouped cloned.
    if (!cloned.expanded) {
      for (const c of cloned.tail.children) {
        c.parent = cloned;
      }
    } else {
      for (const c of cloned.children) {
        c.parent = cloned.tail;
      }
    }

    cloned.head.parent = cloned;
    cloned.tail.parent = cloned;
  } else if (isSiblingAutogroupedNode(cloned)) {
    for (const child of node.children) {
      const childClone = cloneTraceTreeNode(child);
      cloned.children.push(childClone);
      childClone.parent = cloned;
    }
  } else {
    for (const child of node.children) {
      const childClone = cloneTraceTreeNode(child);
      cloned.children.push(childClone);
      childClone.parent = cloned;
    }
  }

  node.cloneReference = cloned;
  return cloned;
}

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
  const multiplier = first.multiplier;

  if (!isSpanNode(first)) {
    throw new Error('Autogrouped node must have span children');
  }

  const segments: [number, number][] = [];

  let start = first.value.start_timestamp;
  let end = first.value.timestamp;
  let i = 1;

  while (i < nodes.length) {
    const next = nodes[i];

    if (!isSpanNode(next)) {
      throw new Error('Autogrouped node must have span children');
    }

    if (next.value.start_timestamp > end) {
      segments.push([start * multiplier, (end - start) * multiplier]);
      start = next.value.start_timestamp;
      end = next.value.timestamp;
      i++;
    } else {
      end = next.value.timestamp;
      i++;
    }
  }

  segments.push([start * multiplier, (end - start) * multiplier]);

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
