import {isSpanNode} from '../traceGuards';

import type {TraceTree} from './traceTree';
import {TraceTreeNode} from './traceTreeNode';

export class MissingInstrumentationNode extends TraceTreeNode<TraceTree.MissingInstrumentationSpan> {
  next: TraceTreeNode<TraceTree.Span>;
  previous: TraceTreeNode<TraceTree.Span>;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue>,
    node: TraceTree.MissingInstrumentationSpan,
    metadata: TraceTree.Metadata,
    previous: TraceTreeNode<TraceTree.Span>,
    next: TraceTreeNode<TraceTree.Span>
  ) {
    super(parent, node, metadata);

    this.next = next;
    this.previous = previous;
  }
}

const MISSING_INSTRUMENTATION_SPAN_THRESHOLD_SECONDS = 0.1;
export function shouldInsertMissingInstrumentationSpan(
  previous: TraceTreeNode<TraceTree.NodeValue>,
  current: TraceTreeNode<TraceTree.NodeValue>
) {
  if (!isSpanNode(previous) || !isSpanNode(current)) {
    return false;
  }

  return (
    current.value.start_timestamp - previous.value.timestamp >
    MISSING_INSTRUMENTATION_SPAN_THRESHOLD_SECONDS
  );
}

export function insertMissingInstrumentationSpan(
  parent: TraceTreeNode<TraceTree.NodeValue>,
  previous: TraceTreeNode<TraceTree.NodeValue>,
  current: TraceTreeNode<TraceTree.NodeValue>
) {
  if (!isSpanNode(previous) || !isSpanNode(current)) {
    throw new Error('Cannot insert missing instrumentation between non-span nodes');
  }

  const node = new MissingInstrumentationNode(
    parent,
    {
      type: 'missing_instrumentation',
      start_timestamp: previous.value.timestamp,
      timestamp: current.value.start_timestamp,
    },
    {
      event_id: undefined,
      project_slug: undefined,
    },
    previous,
    current
  );

  parent.spanChildren.push(node);
}
