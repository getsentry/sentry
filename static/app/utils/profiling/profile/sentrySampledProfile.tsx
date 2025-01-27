import moment from 'moment-timezone';

import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';

import type {Frame} from './../frame';
import {Profile} from './profile';
import type {createSentrySampleProfileFrameIndex} from './utils';
import {sortProfileSamples} from './utils';

type WeightedSample = Profiling.SentrySampledProfile['profile']['samples'][0] & {
  weight: number;
};

export class SentrySampledProfile extends Profile {
  static FromProfile(
    sampledProfile: Profiling.SentrySampledProfile,
    frameIndex: ReturnType<typeof createSentrySampleProfileFrameIndex>,
    options: {
      type: 'flamechart' | 'flamegraph';
      frameFilter?: (frame: Frame) => boolean;
    }
  ): Profile {
    const weightedSamples: WeightedSample[] = sampledProfile.profile.samples.map(
      (sample, i) => {
        // falling back to the current sample timestamp has the effect
        // of giving the last sample a weight of 0
        const nextSample = sampledProfile.profile.samples[i + 1] ?? sample;
        return {
          ...sample,
          weight: nextSample.elapsed_since_start_ns - sample.elapsed_since_start_ns,
        };
      }
    );

    function resolveFrame(index: any): Frame {
      const resolvedFrame = frameIndex[index];
      if (!resolvedFrame) {
        throw new Error(`Could not resolve frame ${index} in frame index`);
      }
      return resolvedFrame;
    }

    const {frames, stacks} = sampledProfile.profile;
    const samples =
      options.type === 'flamegraph'
        ? sortProfileSamples<WeightedSample>(
            weightedSamples,
            stacks,
            frames,
            options.frameFilter ? i => options.frameFilter!(resolveFrame(i)) : undefined
          )
        : weightedSamples;

    const startedAt = samples[0]!.elapsed_since_start_ns;
    const endedAt = samples[samples.length - 1]!.elapsed_since_start_ns;
    if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
      throw TypeError('startedAt or endedAt is NaN');
    }

    const {threadId, threadName} = getThreadData(sampledProfile);

    const profile = new SentrySampledProfile({
      // .unix() only has second resolution
      timestamp: moment(sampledProfile.timestamp).valueOf() / 1000,
      duration: endedAt - startedAt,
      startedAt,
      endedAt,
      unit: 'nanoseconds',
      name: threadName,
      threadId,
      type: options.type,
    });

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]!;
      let stack = stacks[sample!.stack_id].map(resolveFrame);

      if (options.frameFilter) {
        stack = stack.filter((frame: any) => options.frameFilter!(frame));
      }

      profile.appendSampleWithWeight(stack, sample.weight);
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

    let node = this.callTree;
    const framesInStack: CallTreeNode[] = [];

    // frames are ordered outermost -> innermost so we have to iterate backward
    for (let i = stack.length - 1; i >= 0; i--) {
      const frame = stack[i]!;
      const last = node.children[node.children.length - 1];
      // Find common frame between two stacks
      if (last && !last.isLocked() && last.frame === frame) {
        node = last;
      } else {
        const parent = node;
        node = new CallTreeNode(frame, node);
        parent.children.push(node);
      }

      node.totalWeight += weight;

      // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack
      // We check the stack in a top-down order to find the first recursive frame.
      let start = framesInStack.length - 1;
      while (start >= 0) {
        if (framesInStack[start]!.frame === node.frame) {
          // The recursion edge is bidirectional
          framesInStack[start]!.recursive = node;
          node.recursive = framesInStack[start]!;
          break;
        }
        start--;
      }

      framesInStack.push(node);
    }

    node.selfWeight += weight;
    this.minFrameDuration = Math.min(weight, this.minFrameDuration);

    // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.
    for (const child of node.children) {
      child.lock();
    }

    node.frame.selfWeight += weight;

    for (const stackNode of framesInStack) {
      stackNode.frame.totalWeight += weight;
      stackNode.count++;
    }

    // If node is the same as the previous sample, add the weight to the previous sample
    if (node === this.samples[this.samples.length - 1]) {
      this.weights[this.weights.length - 1]! += weight;
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

const COCOA_MAIN_THREAD = 'com.apple.main-thread';

function getThreadData(profile: Profiling.SentrySampledProfile): {
  threadId: number;
  threadName: string;
} {
  const {samples, queue_metadata = {}, thread_metadata = {}} = profile.profile;
  const sample = samples[0]!;
  const threadId = parseInt(sample.thread_id, 10);

  const threadName = thread_metadata?.[threadId]?.name;
  if (threadName) {
    return {threadId, threadName};
  }

  // cocoa has a queue address that we fall back to to try to get a thread name
  // is this the only platform string to check for?
  if (profile.platform === 'cocoa') {
    // only the active thread should get the main thread name
    if (threadId === profile.transaction.active_thread_id) {
      return {threadId, threadName: COCOA_MAIN_THREAD};
    }

    const queueName =
      sample.queue_address && queue_metadata?.[sample.queue_address]?.label;

    // if a queue has the main thread name, we discard it
    if (queueName && queueName !== COCOA_MAIN_THREAD) {
      return {threadId, threadName: queueName};
    }
  }

  return {threadId, threadName: ''};
}
