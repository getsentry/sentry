import moment from 'moment';

import {defined, lastOfArray} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';

import {Frame} from './../frame';
import {Profile} from './profile';
import {createSentrySampleProfileFrameIndex} from './utils';

type WeightedSample = Profiling.SentrySampledProfile['profile']['samples'][0] & {
  weight: number;
};

function sortSentrySampledProfileSamples(
  samples: Readonly<WeightedSample[]>,
  stacks: Profiling.SentrySampledProfile['profile']['stacks'],
  frames: Profiling.SentrySampledProfile['profile']['frames'],
  frameFilter?: (i: number) => boolean
) {
  const frameIds = [...Array(frames.length).keys()].sort((a, b) => {
    const frameA = frames[a];
    const frameB = frames[b];

    if (defined(frameA.function) && defined(frameB.function)) {
      // sort alphabetically first
      const ret = frameA.function.localeCompare(frameB.function);
      if (ret !== 0) {
        return ret;
      }

      // break ties using the line number
      if (defined(frameA.lineno) && defined(frameB.lineno)) {
        return frameA.lineno - frameB.lineno;
      }

      if (defined(frameA.lineno)) {
        return -1;
      }

      if (defined(frameB.lineno)) {
        return 1;
      }
    } else if (defined(frameA.function)) {
      // if only frameA is defined, it goes first
      return -1;
    } else if (defined(frameB.function)) {
      // if only frameB is defined, it goes first
      return 1;
    }

    // if neither functions are defined, they're treated as equal
    return 0;
  });

  const framesMapping = frameIds.reduce((acc, frameId, idx) => {
    acc[frameId] = idx;
    return acc;
  }, {});

  return [...samples].sort((a, b) => {
    // same stack id, these are the same
    if (a.stack_id === b.stack_id) {
      return 0;
    }

    const stackA = frameFilter
      ? stacks[a.stack_id].filter(frameFilter)
      : stacks[a.stack_id];
    const stackB = frameFilter
      ? stacks[b.stack_id].filter(frameFilter)
      : stacks[b.stack_id];

    const minDepth = Math.min(stackA.length, stackB.length);

    for (let i = 0; i < minDepth; i++) {
      // we iterate from the end of each stack because that's where the main function is
      const frameIdA = stackA[stackA.length - i - 1];
      const frameIdB = stackB[stackB.length - i - 1];

      // same frame id, so check the next frame in the stack
      if (frameIdA === frameIdB) {
        continue;
      }

      const frameIdxA = framesMapping[frameIdA];
      const frameIdxB = framesMapping[frameIdB];

      // same frame idx, so check the next frame in the stack
      if (frameIdxA === frameIdxB) {
        continue;
      }

      return frameIdxA - frameIdxB;
    }

    // if all frames up to the depth of the shorter stack matches,
    // then the deeper stack goes first
    return stackB.length - stackA.length;
  });
}

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

    function resolveFrame(index): Frame {
      const resolvedFrame = frameIndex[index];
      if (!resolvedFrame) {
        throw new Error(`Could not resolve frame ${index} in frame index`);
      }
      return resolvedFrame;
    }

    const {frames, stacks} = sampledProfile.profile;
    const samples =
      options.type === 'flamegraph'
        ? sortSentrySampledProfileSamples(
            weightedSamples,
            stacks,
            frames,
            options.frameFilter ? i => options.frameFilter!(resolveFrame(i)) : undefined
          )
        : weightedSamples;

    const startedAt = samples[0].elapsed_since_start_ns;
    const endedAt = samples[samples.length - 1].elapsed_since_start_ns;
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
      const sample = samples[i];
      let stack = stacks[sample.stack_id].map(resolveFrame);

      if (options.frameFilter) {
        stack = stack.filter(frame => options.frameFilter!(frame));
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

      node.totalWeight += weight;

      // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack
      // We check the stack in a top-down order to find the first recursive frame.
      let start = framesInStack.length - 1;
      while (start >= 0) {
        if (framesInStack[start].frame === node.frame) {
          // The recursion edge is bidirectional
          framesInStack[start].recursive = node;
          node.recursive = framesInStack[start];
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

const COCOA_MAIN_THREAD = 'com.apple.main-thread';

function getThreadData(profile: Profiling.SentrySampledProfile): {
  threadId: number;
  threadName: string;
} {
  const {samples, queue_metadata = {}, thread_metadata = {}} = profile.profile;
  const sample = samples[0];
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
