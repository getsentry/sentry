import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';

import {Frame} from './../frame';
import {Profile} from './profile';
import {createFrameIndex} from './utils';

function sortStacks(
  a: {stack: number[]; weight: number},
  b: {stack: number[]; weight: number}
) {
  const max = Math.max(a.stack.length, b.stack.length);

  for (let i = 0; i < max; i++) {
    if (a.stack[i] === undefined) {
      return -1;
    }
    if (b.stack[i] === undefined) {
      return 1;
    }
    if (a.stack[i] === b.stack[i]) {
      continue;
    }
    return a.stack[i] - b.stack[i];
  }
  return 0;
}

function stacksWithWeights(profile: Readonly<Profiling.SampledProfile>) {
  return profile.samples.map((stack, index) => {
    return {
      stack,
      weight: profile.weights[index],
    };
  });
}

function sortSamples(
  profile: Readonly<Profiling.SampledProfile>
): {stack: number[]; weight: number}[] {
  return stacksWithWeights(profile).sort(sortStacks);
}

function throwIfMissingFrame(index: number) {
  throw new Error(`Could not resolve frame ${index} in frame index`);
}

// This is a simplified port of speedscope's profile with a few simplifications and some removed functionality.
// head at commit e37f6fa7c38c110205e22081560b99cb89ce885e

// We should try and remove these as we adopt our own profile format and only rely on the sampled format.
export class SampledProfile extends Profile {
  static FromProfile(
    sampledProfile: Profiling.SampledProfile,
    frameIndex: ReturnType<typeof createFrameIndex>,
    options: {type: 'flamechart' | 'flamegraph'}
  ): Profile {
    const profile = new SampledProfile({
      duration: sampledProfile.endValue - sampledProfile.startValue,
      startedAt: sampledProfile.startValue,
      endedAt: sampledProfile.endValue,
      name: sampledProfile.name,
      unit: sampledProfile.unit,
      threadId: sampledProfile.threadID,
      type: options.type,
    });

    if (sampledProfile.samples.length !== sampledProfile.weights.length) {
      throw new Error(
        `Expected samples.length (${sampledProfile.samples.length}) to equal weights.length (${sampledProfile.weights.length})`
      );
    }

    const samples =
      options.type === 'flamegraph'
        ? sortSamples(sampledProfile)
        : stacksWithWeights(sampledProfile);

    // We process each sample in the profile while maintaining a resolved stack of frames.
    // There is a special case for GC frames where they are appended on top of the previos stack.
    // By reusing the stack buffer, we avoid creating a new array for each sample and for GC case,
    // also avoid re-resolving the previous stack frames as they are already in the buffer.

    // If we encounter multiple consecutive GC frames, we will merge them into a single sample
    // and sum their weights so that only one of them is processed.

    // After we resolve the stack, we call appendSampleWithWeight with the stack buffer, weight
    // and size of the stack to process. The size indicates how many items from the buffer we want
    // to process.

    const resolvedStack: Frame[] = new Array(256); // stack size limit

    for (let i = 0; i < samples.length; i++) {
      const stack = samples[i].stack;
      let weight = samples[i].weight;
      let size = samples[i].stack.length;
      let useCurrentStack = true;

      if (
        options.type === 'flamechart' &&
        i > 0 &&
        // We check for size <= 2 because we have so far only seen node profiles
        // where GC is either marked as the root node or is directly under the root node.
        // There is a good chance that this logic will at some point live on the backend
        // and when that happens, we do not want to enter this case as the GC will already
        // be placed at the top of the previous stack and the new stack length will be > 2
        stack.length <= 2 &&
        frameIndex[stack[stack.length - 1]]?.name === '(garbage collector) [native code]'
      ) {
        // We have a GC frame, so we will use the previous stack
        useCurrentStack = false;
        // The next stack we will process will be the previous stack + our new gc frame.
        // We write the GC frame on top of the previous stack and set the size to the new stack length.
        resolvedStack[samples[i - 1].stack.length] = frameIndex[stack[stack.length - 1]];
        // Size is not sample[i-1].size + our gc frame
        size = samples[i - 1].stack.length + 1;

        // Now collect all weights of all the consecutive gc frames and skip the samples
        while (
          samples[i + 1] &&
          // We check for size <= 2 because we have so far only seen node profiles
          // where GC is either marked as the root node or is directly under the root node.
          // There is a good chance that this logic will at some point live on the backend
          // and when that happens, we do not want to enter this case as the GC will already
          // be placed at the top of the previous stack and the new stack length will be > 2
          samples[i + 1].stack.length <= 2 &&
          frameIndex[samples[i + 1].stack[samples[i + 1].stack.length - 1]]?.name ===
            '(garbage collector) [native code]'
        ) {
          weight += samples[++i].weight;
        }
      }

      // If we are using the current stack, then we need to resolve the frames,
      // else the processed frames will be the frames that were previously resolved
      if (useCurrentStack) {
        for (let j = 0; j < stack.length; j++) {
          resolvedStack[j] = frameIndex[stack[j]] ?? throwIfMissingFrame(stack[j]);
        }
      }

      profile.appendSampleWithWeight(resolvedStack, weight, size);
    }

    return profile.build();
  }

  static Example = SampledProfile.FromProfile(
    {
      startValue: 0,
      endValue: 1000,
      name: 'Example sampled profile',
      threadID: 0,
      unit: 'millisecond',
      weights: [200, 200, 200, 200, 200],
      samples: [
        [0, 1, 2],
        [0, 1, 2, 3, 4, 5],
        [0, 1, 2, 3],
        [0, 1, 2, 3, 4],
        [0, 1],
      ],
      type: 'sampled',
    },
    {
      0: new Frame({key: 0, name: 'f0'}),
      1: new Frame({key: 1, name: 'f1'}),
      2: new Frame({key: 2, name: 'f2'}),
      3: new Frame({key: 3, name: 'f3'}),
      4: new Frame({key: 4, name: 'f4'}),
      5: new Frame({key: 5, name: 'f5'}),
    },
    {type: 'flamechart'}
  );

  appendSampleWithWeight(stack: Frame[], weight: number, end: number): void {
    // Keep track of discarded samples and ones that may have negative weights
    this.trackSampleStats(weight);

    // Ignore samples with 0 weight
    if (weight === 0) {
      return;
    }

    let node = this.callTree;
    const framesInStack: CallTreeNode[] = [];

    for (let i = 0; i < end; i++) {
      const frame = stack[i];
      const last = node.children[node.children.length - 1];
      // Find common frame between two stacks
      if (last && !last.isLocked() && last.frame === frame) {
        node = last;
      } else {
        const parent = node;
        node = new CallTreeNode(frame, node);
        parent.children.push(node);
      }

      node.addToTotalWeight(weight);

      // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack
      // We check the stack in a top-down order to find the first recursive frame.
      let start = framesInStack.length - 1;
      while (start >= 0) {
        if (framesInStack[start].frame === node.frame) {
          // The recursion edge is bidirectional
          framesInStack[start].setRecursiveThroughNode(node);
          node.setRecursiveThroughNode(framesInStack[start]);
          break;
        }
        start--;
      }

      framesInStack[i] = node;
    }

    node.addToSelfWeight(weight);
    this.minFrameDuration = Math.min(weight, this.minFrameDuration);

    // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.
    for (const child of node.children) {
      child.lock();
    }

    node.frame.addToSelfWeight(weight);

    for (const stackNode of framesInStack) {
      stackNode.frame.addToTotalWeight(weight);
      stackNode.incrementCount();
    }

    // If node is the same as the previous sample, add the weight to the previous sample
    if (node === this.samples[this.samples.length - 1]) {
      this.weights[this.weights.length - 1] += weight;
    } else {
      this.samples.push(node);
      this.weights.push(weight);
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
