import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';

import {assertValidProfilingUnit} from '../units/units';

import {Frame} from './../frame';
import {Profile} from './profile';
import type {createFrameIndex} from './utils';
import {resolveFlamegraphSamplesProfileIds} from './utils';

function sortStacks(
  a: {stack: number[]; weight: number | undefined},
  b: {stack: number[]; weight: number | undefined}
) {
  const max = Math.max(a.stack.length, b.stack.length);

  for (let i = 0; i < max; i++) {
    const aStackI = a.stack[i];
    const bStackI = b.stack[i];
    if (aStackI === undefined) {
      return -1;
    }
    if (bStackI === undefined) {
      return 1;
    }
    if (aStackI === bStackI) {
      continue;
    }
    return aStackI - bStackI;
  }
  return 0;
}

function stacksWithWeights(
  profile: Readonly<Profiling.SampledProfile>,
  profileIds: Profiling.ProfileReference[][] = [],
  frameFilter?: (i: number) => boolean
) {
  return profile.samples.map((stack, index) => {
    return {
      stack: frameFilter ? stack.filter(frameFilter) : stack,
      weight: profile.weights[index],
      aggregate_sample_duration: profile.sample_durations_ns?.[index] ?? 0,
      profileIds: profileIds[index],
    };
  });
}

function sortSamples(
  profile: Readonly<Profiling.SampledProfile>,
  profileIds: Profiling.ProfileReference[][] = [],
  frameFilter?: (i: number) => boolean
): Array<{
  aggregate_sample_duration: number;
  stack: number[];
  weight: number | undefined;
}> {
  return stacksWithWeights(profile, profileIds, frameFilter).sort(sortStacks);
}

function mergeProfileExamples(
  profileIds: Readonly<Profiling.SampledProfile['samples_profiles']>,
  profileReferences: Readonly<Profiling.SampledProfile['samples_examples']>
): number[][] {
  const merged: number[][] = [];

  const l = Math.max(profileIds?.length ?? 0, profileReferences?.length ?? 0);
  for (let i = 0; i < l; i++) {
    merged[i] = (profileIds?.[i] ?? []).concat(profileReferences?.[i] ?? []);
  }

  return merged;
}

// We should try and remove these as we adopt our own profile format and only rely on the sampled format.
export class SampledProfile extends Profile {
  static FromProfile(
    sampledProfile: Profiling.SampledProfile,
    frameIndex: ReturnType<typeof createFrameIndex>,
    options: {
      type: 'flamechart' | 'flamegraph';
      frameFilter?: (frame: Frame) => boolean;
      profileIds?:
        | Profiling.Schema['shared']['profile_ids']
        | Profiling.Schema['shared']['profiles'];
    }
  ): Profile {
    assertValidProfilingUnit(sampledProfile.unit);
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

    let resolvedProfileIds: Profiling.ProfileReference[][] = [];
    if (
      options.type === 'flamegraph' &&
      (sampledProfile.samples_profiles || sampledProfile.samples_examples) &&
      options.profileIds
    ) {
      resolvedProfileIds = resolveFlamegraphSamplesProfileIds(
        mergeProfileExamples(
          sampledProfile.samples_profiles,
          sampledProfile.samples_examples
        ),
        options.profileIds as Profiling.ProfileReference[]
      );
    }

    function resolveFrame(index: number) {
      const resolvedFrame = frameIndex[index];
      if (!resolvedFrame) {
        throw new Error(`Could not resolve frame ${index} in frame index`);
      }
      return resolvedFrame;
    }

    const samples =
      options.type === 'flamegraph'
        ? sortSamples(
            sampledProfile,
            resolvedProfileIds,
            options.frameFilter ? i => options.frameFilter!(resolveFrame(i)) : undefined
          )
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
    let size = 0;
    let frame: Frame | null = null;

    for (let i = 0; i < samples.length; i++) {
      const stack = samples[i]!.stack;
      let weight = samples[i]!.weight!;
      let aggregate_duration_ns = samples[i]!.aggregate_sample_duration;

      const isGCStack =
        options.type === 'flamechart' &&
        i > 0 &&
        // We check for size <= 2 because we have so far only seen node profiles
        // where GC is either marked as the root node or is directly under the root node.
        // There is a good chance that this logic will at some point live on the backend
        // and when that happens, we do not want to enter this case as the GC will already
        // be placed at the top of the previous stack and the new stack length will be > 2
        stack.length <= 2 &&
        frameIndex[stack[stack.length - 1]!]?.name ===
          '(garbage collector) [native code]';

      if (isGCStack) {
        // The next stack we will process will be the previous stack + our new gc frame.
        // We write the GC frame on top of the previous stack and set the size to the new stack length.
        frame = resolveFrame(stack[stack.length - 1]!);
        if (frame) {
          resolvedStack[samples[i - 1]!.stack.length] =
            frameIndex[stack[stack.length - 1]!]!;
          size += 1; // size of previous stack + new gc frame

          // Now collect all weights of all the consecutive gc frames and skip the samples
          while (
            samples[i + 1] &&
            // We check for size <= 2 because we have so far only seen node profiles
            // where GC is either marked as the root node or is directly under the root node.
            // There is a good chance that this logic will at some point live on the backend
            // and when that happens, we do not want to enter this case as the GC will already
            // be placed at the top of the previous stack and the new stack length will be > 2
            samples[i + 1]!.stack.length <= 2 &&
            frameIndex[samples[i + 1]!.stack[samples[i + 1]!.stack.length - 1]!]?.name ===
              '(garbage collector) [native code]'
          ) {
            weight += samples[++i]!.weight!;
            aggregate_duration_ns += samples[i]!.aggregate_sample_duration;
          }
        }
      } else {
        size = 0;
        // If we are using the current stack, then we need to resolve the frames,
        // else the processed frames will be the frames that were previously resolved
        for (const index of stack) {
          frame = resolveFrame(index);
          if (!frame) {
            continue;
          }
          resolvedStack[size++] = frame;
        }
      }

      profile.appendSampleWithWeight(
        resolvedStack,
        weight,
        size,
        resolvedProfileIds[i],
        aggregate_duration_ns
      );
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
      0: new Frame({key: 0, name: 'f0', is_application: true}),
      1: new Frame({key: 1, name: 'f1', is_application: true}),
      2: new Frame({key: 2, name: 'f2'}),
      3: new Frame({key: 3, name: 'f3'}),
      4: new Frame({key: 4, name: 'f4', is_application: true}),
      5: new Frame({key: 5, name: 'f5'}),
    },
    {type: 'flamechart'}
  );

  appendSampleWithWeight(
    stack: Frame[],
    weight: number,
    end: number,
    resolvedProfileIds?: Profiling.ProfileReference[] | string[],
    aggregate_duration_ns?: number
  ): void {
    // Keep track of discarded samples and ones that may have negative weights
    this.trackSampleStats(weight);

    // Ignore samples with 0 weight
    if (weight === 0) {
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
        if (resolvedProfileIds) {
          this.callTreeNodeProfileIdMap.set(node, resolvedProfileIds);
        }
      }

      node.totalWeight += weight;
      node.aggregate_duration_ns += aggregate_duration_ns ?? 0;

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
      stackNode.frame.aggregateDuration += aggregate_duration_ns ?? 0;
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
