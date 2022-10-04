import {lastOfArray} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';

import {Frame} from './../frame';
import {Profile} from './profile';
import {createSentrySampleProfileFrameIndex} from './utils';

// This is a simplified port of speedscope's profile with a few simplifications and some removed functionality.
// head at commit e37f6fa7c38c110205e22081560b99cb89ce885e

// We should try and remove these as we adopt our own profile format and only rely on the sampled format.
export class SentrySampledProfile extends Profile {
  static FromProfile(
    sampledProfile: Profiling.SentrySampledProfile,
    frameIndex: ReturnType<typeof createSentrySampleProfileFrameIndex>
  ): Profile {
    const {samples, stacks, thread_metadata = {}} = sampledProfile.profile;
    const startedAt = parseInt(samples[0].elapsed_since_start_ns, 10);
    const endedAt = parseInt(samples[samples.length - 1].elapsed_since_start_ns, 10);
    if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
      throw TypeError('startedAt or endedAt is NaN');
    }
    const threadId = parseInt(samples[0].thread_id, 10);
    const threadName = `thread: ${
      thread_metadata[samples[0].thread_id]?.name || threadId
    }`;
    const profileTransactionName = sampledProfile.transactions?.[0]?.name;
    const profile = new SentrySampledProfile({
      duration: endedAt - startedAt,
      startedAt,
      endedAt,
      unit: 'nanoseconds',
      name: profileTransactionName
        ? `${profileTransactionName} (${threadName})`
        : threadName,
      threadId,
    });

    let previousSampleWeight = 0;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const stack = stacks[sample.stack_id];
      const sampleWeight = parseInt(sample.elapsed_since_start_ns, 10);

      profile.appendSampleWithWeight(
        stack.map(n => {
          if (!frameIndex[n]) {
            throw new Error(`Could not resolve frame ${n} in frame index`);
          }

          return frameIndex[n];
        }),
        sampleWeight - previousSampleWeight
      );

      previousSampleWeight = sampleWeight;
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

    // frames are ordered outermost -> innermost so we have to iterate backward
    for (let i = stack.length - 1; i >= 0; i--) {
      const frame = stack[i];
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
