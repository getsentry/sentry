import {lastOfArray} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';

import {Frame} from './../frame';
import {Profile} from './profile';
import {createFrameIndex} from './utils';

// This is a simplified port of speedscope's profile with a few simplifications and some removed functionality.
// head at commit e37f6fa7c38c110205e22081560b99cb89ce885e

// We should try and remove these as we adopt our own profile format and only rely on the sampled format.
export class SampledProfile extends Profile {
  static FromProfile(
    sampledProfile: Profiling.SampledProfile,
    frameIndex: ReturnType<typeof createFrameIndex>
  ): Profile {
    const profile = new SampledProfile({
      duration: sampledProfile.endValue - sampledProfile.startValue,
      startedAt: sampledProfile.startValue,
      endedAt: sampledProfile.endValue,
      name: sampledProfile.name,
      unit: sampledProfile.unit,
      threadId: sampledProfile.threadID,
    });

    if (sampledProfile.samples.length !== sampledProfile.weights.length) {
      throw new Error(
        `Expected samples.length (${sampledProfile.samples.length}) to equal weights.length (${sampledProfile.weights.length})`
      );
    }

    for (let i = 0; i < sampledProfile.samples.length; i++) {
      const stack = sampledProfile.samples[i];
      const weight = sampledProfile.weights[i];

      profile.appendSampleWithWeight(
        stack.map(n => {
          if (!frameIndex[n]) {
            throw new Error(`Could not resolve frame ${n} in frame index`);
          }

          return frameIndex[n];
        }),
        weight
      );
    }

    return profile.build();
  }

  appendSampleWithWeight(stack: Frame[], weight: number): void {
    // Keep track of discarded samples and ones that may have negative weights
    this.trackSampleStats(weight);

    // Ignore samples with 0 weight
    if (weight === 0) {
      return;
    }

    let node = this.appendOrderTree;
    const framesInStack: CallTreeNode[] = [];

    for (const frame of stack) {
      const last = lastOfArray(node.children);
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

      framesInStack.push(node);
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
    }

    // If node is the same as the previous sample, add the weight to the previous sample
    if (node === lastOfArray(this.samples)) {
      this.weights[this.weights.length - 1] += weight;
    } else {
      this.samples.push(node);
      this.weights.push(weight);
    }
    this.rawWeights.push(weight);
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
