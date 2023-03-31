import {t} from 'sentry/locale';

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
  collapsed?: FlamegraphFrame[];
  processId?: number;
  profileIds?: string[];
  threadId?: number;
}

export function getFlamegraphFrameDisplayName(frame: FlamegraphFrame) {
  if (frame.collapsed && frame.collapsed.length > 0) {
    return t('%s collapsed frames', frame.collapsed.length);
  }

  return frame.frame.name;
}

export function getFlamegraphFrameSearchId(frame: FlamegraphFrame) {
  return (
    frame.frame.name + (frame.frame.file ? frame.frame.file : '') + String(frame.start)
  );
}
