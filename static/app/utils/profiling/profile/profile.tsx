import {lastOfArray} from 'sentry/utils';

import {CallTreeNode} from '../callTreeNode';
import {Frame} from '../frame';

interface ProfileStats {
  discardedSamplesCount: number;
  negativeSamplesCount: number;
}

// This is a simplified port of speedscope's profile with a few simplifications and some removed functionality + some added functionality.
// head at commit e37f6fa7c38c110205e22081560b99cb89ce885e

// We should try and remove these as we adopt our own profile format and only rely on the sampled format.
export class Profile {
  // Duration of the profile
  duration: number;
  // Started at ts of the profile - varies between implementations of the profiler.
  // For JS self profiles, this is the time origin (https://www.w3.org/TR/hr-time-2/#dfn-time-origin), for others it's epoch time
  startedAt: number;
  // Ended at ts of the profile - varies between implementations of the profiler.
  // For JS self profiles, this is the time origin (https://www.w3.org/TR/hr-time-2/#dfn-time-origin), for others it's epoch time
  endedAt: number;
  threadId: number;

  // Unit in which the timings are reported in
  unit = 'microseconds';
  // Name of the profile
  name = 'Unknown';

  appendOrderTree: CallTreeNode = new CallTreeNode(Frame.Root, null);
  framesInStack: Set<Profiling.Event['frame']> = new Set();

  // Min duration of the profile
  minFrameDuration = Number.POSITIVE_INFINITY;

  samples: CallTreeNode[] = [];
  weights: number[] = [];
  rawWeights: number[] = [];

  stats: ProfileStats = {
    discardedSamplesCount: 0,
    negativeSamplesCount: 0,
  };

  constructor({
    duration,
    startedAt,
    endedAt,
    name,
    unit,
    threadId,
  }: {
    duration: number;
    endedAt: number;
    name: string;
    startedAt: number;
    threadId: number;
    unit: string;
  }) {
    this.threadId = threadId;
    this.duration = duration;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.name = name;
    this.unit = unit;
  }

  static Empty = new Profile({
    duration: 1000,
    startedAt: 0,
    endedAt: 1000,
    name: 'Empty Profile',
    unit: 'milliseconds',
    threadId: 0,
  }).build();

  isEmpty(): boolean {
    return this === Profile.Empty;
  }

  trackSampleStats(duration: number) {
    // Keep track of discarded samples and ones that may have negative weights
    if (duration === 0) {
      this.stats.discardedSamplesCount++;
    }
    if (duration < 0) {
      this.stats.negativeSamplesCount++;
    }
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
