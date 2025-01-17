import type {createContinuousProfileFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {CallTreeNode} from '../callTreeNode';
import type {Frame} from '../frame';

import {Profile} from './profile';
import {sortProfileSamples} from './utils';

type WeightedSample = Profiling.ContinuousProfile['samples'][number] & {
  weight: number;
};

export class ContinuousProfile extends Profile {
  static FromProfile(
    chunk: Profiling.ContinuousProfile,
    frameIndex: ReturnType<typeof createContinuousProfileFrameIndex>,
    options: {
      type: 'flamechart' | 'flamegraph';
      frameFilter?: (frame: Frame) => boolean;
    }
  ): ContinuousProfile {
    const firstSample = chunk.samples[0]!;
    const lastSample = chunk.samples[chunk.samples.length - 1]!;

    const {threadId, threadName} = getThreadData(chunk);

    const profile = new ContinuousProfile({
      // Duration is in seconds, convert to nanoseconds
      duration: (lastSample.timestamp - firstSample.timestamp) * 1e3,
      endedAt: lastSample.timestamp * 1e3,
      startedAt: firstSample.timestamp * 1e3,
      threadId,
      name: threadName,
      type: options.type,
      unit: 'milliseconds',
    });

    function resolveFrame(index: any) {
      const resolvedFrame = frameIndex[index];
      if (!resolvedFrame) {
        throw new Error(`Could not resolve frame ${index} in frame index`);
      }
      return resolvedFrame;
    }

    const weightedSamples: WeightedSample[] = chunk.samples.map((sample, i) => {
      // falling back to the current sample timestamp has the effect
      // of giving the last sample a weight of 0
      const nextSample = chunk.samples[i + 1] ?? sample;
      return {
        ...sample,
        // Chunk timestamps are in seconds, convert them to ms
        weight: (nextSample.timestamp - sample.timestamp) * 1e3,
      };
    });

    const samples =
      options.type === 'flamegraph'
        ? sortProfileSamples<WeightedSample>(
            weightedSamples,
            chunk.stacks,
            chunk.frames,
            options.frameFilter ? i => options.frameFilter!(resolveFrame(i)) : undefined
          )
        : weightedSamples;

    let frame: Frame | null = null;
    const resolvedStack: Frame[] = new Array(256); // stack size limit

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]!;

      const stack = chunk.stacks[sample.stack_id];
      let size = 0;

      for (let j = stack.length - 1; j >= 0; j--) {
        frame = resolveFrame(stack[j]);
        if (frame && (!options.frameFilter || options.frameFilter(frame))) {
          resolvedStack[size++] = frame;
        }
      }

      profile.appendSample(resolvedStack, sample.weight, size);
    }

    return profile.build();
  }

  appendSample(stack: Frame[], duration: number, end: number): void {
    // Keep track of discarded samples and ones that may have negative weights
    this.trackSampleStats(duration);

    // Ignore samples with 0 weight
    if (duration === 0) {
      return;
    }

    let node = this.callTree;
    const framesInStack: CallTreeNode[] = [];
    for (let i = 0; i < end; i++) {
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

      node.totalWeight += duration;

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

      framesInStack[i] = node;
    }

    node.selfWeight += duration;
    this.minFrameDuration = Math.min(duration, this.minFrameDuration);

    // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.
    for (const child of node.children) {
      child.lock();
    }

    node.frame.selfWeight += duration;

    for (const stackNode of framesInStack) {
      stackNode.frame.totalWeight += duration;
      stackNode.count++;
    }

    // If node is the same as the previous sample, add the weight to the previous sample
    if (node === this.samples[this.samples.length - 1]) {
      this.weights[this.weights.length - 1]! += duration;
    } else {
      this.samples.push(node);
      this.weights.push(duration);
    }
  }

  // @TODO implement this when we need to extend time ranges and append new profiles
  appendProfileStart(): ContinuousProfile {
    throw new Error('Not implemented');
  }
  // @TODO implement this when we need to extend time ranges and append new profiles
  appendToProfileEnd(): ContinuousProfile {
    throw new Error('Not implemented');
  }

  build(): ContinuousProfile {
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

function getThreadData(profile: Profiling.ContinuousProfile): {
  threadId: number;
  threadName: string;
} {
  const {samples, thread_metadata = {}} = profile;
  const sample = samples[0]!;
  const threadId = parseInt(sample.thread_id, 10);

  return {
    threadId,
    threadName: thread_metadata?.[threadId]?.name ?? `Thread ${threadId}`,
  };
}
