import {CallTreeNode} from './callTreeNode';
import {Frame} from './frame';

export interface FlamegraphFrame {
  frame: Frame;
  node: CallTreeNode;
  start: number;
  end: number;
  depth: number;
  parent: FlamegraphFrame | null;
  children: FlamegraphFrame[];
}
