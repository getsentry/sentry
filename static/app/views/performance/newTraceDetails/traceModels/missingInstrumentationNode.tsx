import {isSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';

import type {TraceTree} from './traceTree';
import {TraceTreeNode} from './traceTreeNode';

export class MissingInstrumentationNode extends TraceTreeNode<TraceTree.MissingInstrumentationSpan> {
  next: TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>;
  previous: TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue>,
    node: TraceTree.MissingInstrumentationSpan,
    metadata: TraceTree.Metadata,
    previous: TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>,
    next: TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>
  ) {
    super(parent, node, metadata);

    this.next = next;
    this.previous = previous;

    // The space of a missing instrumentation node is gap between previous end and next start
    const previousEndTimestamp = isSpanNode(previous)
      ? previous.value.timestamp
      : previous.value.end_timestamp;
    this.space = [
      previousEndTimestamp * 1e3,
      (next.value.start_timestamp - previousEndTimestamp) * 1e3,
    ];
  }
}
