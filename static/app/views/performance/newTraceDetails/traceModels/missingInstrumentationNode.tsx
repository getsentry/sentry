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

    // The space of a missing instrumentation node is gap between previous end and next start
    this.space = [
      previous.value.timestamp * 1e3,
      (next.value.start_timestamp - previous.value.timestamp) * 1e3,
    ];
  }
}
