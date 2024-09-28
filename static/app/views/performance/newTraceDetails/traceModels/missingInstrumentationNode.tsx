import {isSpanNode} from '../traceGuards';

import type {TraceTree} from './traceTree';
import {TraceTreeNode} from './traceTreeNode';

// A missing instrumentation node is just a node that is inserted between spans
// to indicate that there is a gap between spans.
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

export function maybeInsertMissingInstrumentationSpan(
  parent: TraceTreeNode<TraceTree.NodeValue>,
  node: TraceTreeNode<TraceTree.Span>
) {
  const previousSpan = parent.spanChildren[parent.spanChildren.length - 1];
  if (!previousSpan || !isSpanNode(previousSpan)) {
    return;
  }

  if (node.value.start_timestamp - previousSpan.value.timestamp < 0.1) {
    return;
  }

  const missingInstrumentationSpan = new MissingInstrumentationNode(
    parent,
    {
      type: 'missing_instrumentation',
      start_timestamp: previousSpan.value.timestamp,
      timestamp: node.value.start_timestamp,
    },
    {
      event_id: undefined,
      project_slug: undefined,
    },
    previousSpan,
    node
  );

  parent.spanChildren.push(missingInstrumentationSpan);
}
