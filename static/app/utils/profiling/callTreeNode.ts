import {Frame} from './frame';
import {WeightedNode} from './weightedNode';

export class CallTreeNode extends WeightedNode {
  readonly frame: Frame;
  readonly parent: CallTreeNode | null;

  private locked = false;

  recursive?: CallTreeNode;
  children: CallTreeNode[] = [];

  constructor(frame: Frame, parent: CallTreeNode | null) {
    super();
    this.parent = parent;
    this.frame = frame;
  }

  setRecursive(node: CallTreeNode): void {
    this.recursive = node;
    this.frame.recursive = node.frame;
  }

  isRecursive(): boolean {
    return !!this.recursive;
  }

  isLocked(): boolean {
    return this.locked;
  }

  freeze(): void {
    this.locked = true;
  }
}
