import {lastOfArray} from 'sentry/utils';

import {CallTreeNode} from '../callTreeNode';
import {Frame} from '../frame';

// This is ported from speedscope with a lot of modifications and simplifications
// head at commit e37f6fa7c38c110205e22081560b99cb89ce885e
export class Profile {
  duration = 0;
  startedAt = 0;
  endedAt = 0;
  lastValue = 0;
  unit = 'microseconds';
  name = 'Unknown';

  framesInStack: Set<Profiling.Event['frame']> = new Set();
  frameIndex: Record<number, Frame> = {};

  minFrameDuration = Number.POSITIVE_INFINITY;

  appendOrderTree: CallTreeNode = new CallTreeNode(Frame.Root, null);

  samples: CallTreeNode[] = [];
  weights: number[] = [];

  constructor(
    duration: number,
    startedAt: number,
    endedAt: number,
    name: string,
    unit: string
  ) {
    this.duration = duration;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.name = name;
    this.unit = unit;
  }

  forEach(
    openFrame: (node: CallTreeNode, value: number) => void,
    closeFrame: (node: CallTreeNode, value: number) => void
  ): void {
    let prevStack: CallTreeNode[] = [];
    let value = 0;

    let sampleIndex = 0;

    for (const stackTop of this.samples) {
      let top: CallTreeNode | null = stackTop;

      while (top && !top.isRoot() && prevStack.indexOf(top) === -1) {
        top = top.parent;
      }

      while (prevStack.length > 0 && lastOfArray(prevStack) !== top) {
        const node = prevStack.pop()!;
        closeFrame(node, value);
      }

      const toOpen: CallTreeNode[] = [];

      let node: CallTreeNode | null = stackTop;

      while (node && !node.isRoot() && node !== top) {
        toOpen.unshift(node);
        node = node.parent;
      }

      for (const toOpenNode of toOpen) {
        openFrame(toOpenNode, value);
      }

      prevStack = prevStack.concat(toOpen);
      value += this.weights[sampleIndex++];
    }

    for (let i = prevStack.length - 1; i >= 0; i--) {
      closeFrame(prevStack[i], value);
    }
  }

  build(): Profile {
    this.duration = Math.max(
      this.duration,
      this.weights.reduce((a, b) => a + b, 0)
    );

    // We had no frames with duration > 0, so set min duration to timeline duration
    // which effectively disables any zooming on the flamegraphs
    if (
      this.minFrameDuration === Number.POSITIVE_INFINITY ||
      this.minFrameDuration === 0
    ) {
      this.minFrameDuration = this.duration;
    }

    return this;
  }
}
