import {computeCollapsedBarSpace} from './parentAutogroupNode';
import type {TraceTree} from './traceTree';
import {TraceTreeNode} from './traceTreeNode';

export class SiblingAutogroupNode extends TraceTreeNode<TraceTree.SiblingAutogroup> {
  groupCount: number = 0;
  profiles: TraceTree.Profile[] = [];

  private _autogroupedSegments: Array<[number, number]> | undefined;

  constructor(
    parent: TraceTreeNode<TraceTree.NodeValue> | null,
    node: TraceTree.SiblingAutogroup,
    metadata: TraceTree.Metadata
  ) {
    super(parent, node, metadata);
    this.expanded = false;
  }

  get autogroupedSegments(): Array<[number, number]> {
    if (this._autogroupedSegments) {
      return this._autogroupedSegments;
    }

    this._autogroupedSegments = computeCollapsedBarSpace(this.children);
    return this._autogroupedSegments;
  }
}
