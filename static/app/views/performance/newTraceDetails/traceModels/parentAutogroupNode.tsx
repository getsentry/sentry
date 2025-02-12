import type {TraceTree} from './traceTree';
import {TraceTreeNode} from './traceTreeNode';

export class ParentAutogroupNode extends TraceTreeNode<TraceTree.ChildrenAutogroup> {
  head: TraceTreeNode<TraceTree.Span>;
  tail: TraceTreeNode<TraceTree.Span>;
  groupCount: number = 0;
  profiles: TraceTree.Profile[] = [];

  private _autogroupedSegments: Array<[number, number]> | undefined;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue> | null,
    node: TraceTree.ChildrenAutogroup,
    metadata: TraceTree.Metadata,
    head: TraceTreeNode<TraceTree.Span>,
    tail: TraceTreeNode<TraceTree.Span>
  ) {
    super(parent, node, metadata);

    this.expanded = false;
    this.head = head;
    this.tail = tail;
  }

  get autogroupedSegments(): Array<[number, number]> {
    if (this._autogroupedSegments) {
      return this._autogroupedSegments;
    }

    const children: Array<TraceTreeNode<TraceTree.NodeValue>> = [];
    let start: TraceTreeNode<TraceTree.NodeValue> | undefined = this.head;

    while (start && start !== this.tail) {
      children.push(start);
      start = start.children[0];
    }

    children.push(this.tail);

    this._autogroupedSegments = computeCollapsedBarSpace(children);
    return this._autogroupedSegments;
  }
}

// Returns a list of segments from a grouping sequence that can be used to render a span bar chart
// It looks for gaps between spans and creates a segment for each gap. If there are no gaps, it
// merges the n and n+1 segments.
export function computeCollapsedBarSpace(
  nodes: Array<TraceTreeNode<TraceTree.NodeValue>>
): Array<[number, number]> {
  if (nodes.length === 0) {
    return [];
  }

  const first = nodes[0]!;

  const segments: Array<[number, number]> = [];

  let start = first.space[0];
  let end = first.space[0] + first.space[1];
  let i = 1;

  while (i < nodes.length) {
    const next = nodes[i]!;

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
