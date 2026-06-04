import {Frame} from './frame';

export class CallTreeNode {
  readonly frame: Frame;

  private locked = false;
  count = 0;
  isRoot: boolean;

  parent: CallTreeNode | null = null;
  recursive: CallTreeNode | null = null;
  children: CallTreeNode[] = [];

  totalWeight = 0;
  selfWeight = 0;

  aggregate_duration_ns = 0;

  static readonly Root = new CallTreeNode(Frame.Root, null);

  constructor(frame: Frame, parent: CallTreeNode | null) {
    this.parent = parent;
    this.frame = frame;
    this.isRoot = Frame.Root.name === this.frame.name;
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
}
