import {CallTreeNode} from '../callTreeNode';
import {Frame} from '../frame';

interface ProfileStats {
  discardedSamplesCount: number;
  negativeSamplesCount: number;
}

export class Profile {
  // The epoch time at which this profile was started. All relative timestamp should be
  // relative to this.
  // Some older formats may not have a timestamp defined.
  timestamp: number | null;
  // Duration of the profile
  duration: number;
  // Releative timestamp of the first sample in the timestamp.
  startedAt: number;
  // Releative timestamp of the last sample in the timestamp.
  endedAt: number;
  threadId: number;
  type: string;

  // Unit in which the timings are reported in
  unit = 'microseconds';
  // Name of the profile
  name = 'Unknown';

  callTree: CallTreeNode = new CallTreeNode(Frame.Root, null);
  framesInStack: Set<Profiling.Event['frame']> = new Set();

  // Min duration of a single frame in our profile
  minFrameDuration = Number.POSITIVE_INFINITY;

  samples: CallTreeNode[] = [];
  sample_durations_ns: number[] = [];
  weights: number[] = [];
  rawWeights: number[] = [];

  stats: ProfileStats = {
    discardedSamplesCount: 0,
    negativeSamplesCount: 0,
  };

  callTreeNodeProfileIdMap: Map<CallTreeNode, string[]> = new Map();

  constructor({
    duration,
    startedAt,
    endedAt,
    name,
    unit,
    threadId,
    timestamp,
    type,
  }: {
    duration: number;
    endedAt: number;
    name: string;
    startedAt: number;
    threadId: number;
    type: string;
    unit: string;
    timestamp?: number;
  }) {
    this.threadId = threadId;
    this.duration = duration;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.name = name;
    this.unit = unit;
    this.type = type ?? '';
    this.timestamp = timestamp ?? null;
  }

  static Empty = new Profile({
    duration: 1000,
    startedAt: 0,
    endedAt: 1000,
    name: 'Empty Profile',
    unit: 'milliseconds',
    threadId: 0,
    type: '',
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
    if (duration > 0) {
      this.rawWeights.push(duration);
    }
  }

  forEach(
    openFrame: (node: CallTreeNode, value: number) => void,
    closeFrame: (node: CallTreeNode, value: number) => void
  ): void {
    const prevStack: CallTreeNode[] = [];
    let value = 0;

    let sampleIndex = 0;

    for (const stackTop of this.samples) {
      let top: CallTreeNode | null = stackTop;

      while (top && !top.isRoot && !prevStack.includes(top)) {
        top = top.parent;
      }

      while (prevStack.length > 0 && prevStack[prevStack.length - 1] !== top) {
        const node = prevStack.pop()!;
        closeFrame(node, value);
      }

      const toOpen: CallTreeNode[] = [];
      let node: CallTreeNode | null = stackTop;

      while (node && !node.isRoot && node !== top) {
        toOpen.push(node);
        node = node.parent;
      }

      for (let i = toOpen.length - 1; i >= 0; i--) {
        openFrame(toOpen[i], value);
        prevStack.push(toOpen[i]);
      }

      value += this.weights[sampleIndex++];
    }

    // Close any remaining frames
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
