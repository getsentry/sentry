import type {TraceTree} from './traceTree';
import {TraceTreeNode} from './traceTreeNode';

export class CollapsedNode extends TraceTreeNode<TraceTree.CollapsedNode> {
  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue>,
    node: TraceTree.CollapsedNode,
    metadata: TraceTree.Metadata
  ) {
    super(parent, node, metadata);
    this.expanded = false;
  }
}
