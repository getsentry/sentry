import {Frame} from './frame';
import {WeightedNode} from './weightedNode';

export class CallTreeNode extends WeightedNode {
  private locked = false;

  readonly frame: Frame = Frame.Root;
  count: number = 0;
  parent: CallTreeNode | null = null;
  recursive: CallTreeNode | null = null;
  children: CallTreeNode[] = [];

  constructor(frame: Frame, parent: CallTreeNode | null) {
    super();
    this.parent = parent;
    this.frame = frame;
  }

  static readonly Root = new CallTreeNode(Frame.Root, null);

  setParent(parent: CallTreeNode): void {
    this.parent = parent;
  }

  setRecursiveThroughNode(node: CallTreeNode): void {
    this.recursive = node;
  }

  incrementCount(): void {
    this.count++;
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
    return Frame.Root.name === this.frame.name;
  }
}
