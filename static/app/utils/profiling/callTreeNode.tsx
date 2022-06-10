import {Frame} from './frame';
import {WeightedNode} from './weightedNode';

export class CallTreeNode extends WeightedNode {
  readonly frame: Frame;

  private locked = false;

  parent: CallTreeNode | null;
  recursive: CallTreeNode | null;
  children: CallTreeNode[] = [];

  constructor(frame: Frame, parent: CallTreeNode | null) {
    super();
    this.recursive = null;
    this.parent = parent;
    this.frame = frame;
  }

  setParent(parent: CallTreeNode): void {
    this.parent = parent;
  }

  setRecursiveThroughNode(node: CallTreeNode): void {
    this.recursive = node;
  }

  isRecursive(): boolean {
    return !!this.recursive;
  }

  isDirectRecursive(): boolean {
    if (!this.parent) {
      return false;
    }
    return this.parent.frame === this.frame;
  }

  isLocked(): boolean {
    return this.locked;
  }

  lock(): void {
    this.locked = true;
  }

  isRoot(): boolean {
    return Frame.Root === this.frame;
  }

  static readonly Root = new CallTreeNode(Frame.Root, null);
}
