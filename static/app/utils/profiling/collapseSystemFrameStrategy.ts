import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';

const isSystemFrame = (frame: FlamegraphFrame) => !frame.node.frame.is_application;

export function collapseSystemFrameStrategy(frame: FlamegraphFrame) {
  const children = frame.children;

  if (children.length === 1) {
    const [child] = children;
    if (isSystemFrame(frame) && isSystemFrame(child)) {
      if (!child.collapsed) {
        child.collapsed = [];
      }
      child.collapsed.push(frame);
      child.parent = frame.parent;
      frame = child;
    }
  }
  return frame;
}
