import {CallTreeNode} from './callTreeNode';
import {Frame} from './frame';

export interface FlamegraphFrame {
  children: FlamegraphFrame[];
  depth: number;
  end: number;
  frame: Frame;
  key: number;
  node: CallTreeNode;
  parent: FlamegraphFrame | null;
  start: number;
}
