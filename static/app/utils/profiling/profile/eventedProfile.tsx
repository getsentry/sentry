import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import type {Frame} from 'sentry/utils/profiling/frame';
import {assertValidProfilingUnit, formatTo} from 'sentry/utils/profiling/units/units';

import {Profile} from './profile';
import type {createFrameIndex} from './utils';

export class EventedProfile extends Profile {
  calltree: CallTreeNode[] = [this.callTree];
  stack: Frame[] = [];

  lastValue = 0;
  samplingIntervalApproximation = 0;

  static FromProfile(
    eventedProfile: Profiling.EventedProfile,
    frameIndex: ReturnType<typeof createFrameIndex>,
    options: {
      type: 'flamechart' | 'flamegraph';
      frameFilter?: (frame: Frame) => boolean;
    }
  ): EventedProfile {
    assertValidProfilingUnit(eventedProfile.unit);
    const profile = new EventedProfile({
      duration: eventedProfile.endValue - eventedProfile.startValue,
      startedAt: eventedProfile.startValue,
      endedAt: eventedProfile.endValue,
      name: eventedProfile.name,
      unit: eventedProfile.unit,
      threadId: eventedProfile.threadID,
      type: options.type,
    });

    // If frames are offset, we need to set lastValue to profile start, so that delta between
    // samples is correctly offset by the start value.
    profile.lastValue = Math.max(0, eventedProfile.startValue);
    profile.samplingIntervalApproximation = formatTo(
      10,
      'milliseconds',
      eventedProfile.unit
    );

    for (const event of eventedProfile.events) {
      const frame = frameIndex[event.frame];

      if (!frame) {
        throw new Error(`Cannot retrieve event: ${event.frame} from frame index`);
      }

      if (options.frameFilter && !options.frameFilter(frame)) {
        continue;
      }

      switch (event.type) {
        // Open a new frame
        case 'O': {
          profile.enterFrame(frame, event.at);
          break;
        }
        // Close a frame
        case 'C': {
          profile.leaveFrame(frame, event.at);
          break;
        }
        default: {
          throw new TypeError(`Unknown event type ${event.type}`);
        }
      }
    }

    const built = profile.build();

    // The way the samples are constructed assumes that the trees are always appended to the
    // calltree. This is not the case for flamegraphs where nodes are mutated in place.
    // Because that assumption is invalidated with flamegraphs, we need to filter
    // out duplicate samples and their weights.
    if (options.type === 'flamegraph') {
      const visited = new Set();
      const samples: CallTreeNode[] = [];
      const weights: number[] = [];

      for (const sample of built.samples) {
        if (visited.has(sample)) {
          continue;
        }

        visited.add(sample);

        samples.push(sample);
        weights.push(sample.totalWeight);
      }

      built.samples = samples;
      built.weights = weights;
    }

    return built;
  }

  addWeightToFrames(weight: number): void {
    const weightDelta = weight - this.lastValue;

    for (const frame of this.stack) {
      frame.totalWeight += weightDelta;
    }

    const top = this.stack[this.stack.length - 1];
    if (top) {
      top.selfWeight += weight;
    }
  }

  addWeightsToNodes(value: number) {
    const delta = value - this.lastValue;

    for (const node of this.calltree) {
      node.totalWeight += delta;
    }
    const stackTop = this.calltree[this.calltree.length - 1];

    if (stackTop) {
      stackTop.selfWeight += delta;
    }
  }

  enterFrame(frame: Frame, at: number): void {
    this.addWeightToFrames(at);
    this.addWeightsToNodes(at);

    const lastTop = this.calltree[this.calltree.length - 1];

    if (lastTop) {
      const sampleDelta = at - this.lastValue;

      if (sampleDelta < 0) {
        throw new Error(
          'Sample delta cannot be negative, samples may be corrupt or out of order'
        );
      }

      // If the sample timestamp is not the same as the same as of previous frame,
      // we can deduce that this is a new sample and need to push it on the stack
      if (sampleDelta > 0) {
        this.samples.push(lastTop);
        this.weights.push(sampleDelta);
      }

      // If we are in flamegraph mode, we will look for any children of the current stack top
      // that may contain the frame we are entering. If we find one, we will use that as the
      // new stack top (this essentially makes it a graph). This does not apply flamecharts,
      // where chronological order matters, in that case we can only look at the last child of the
      // current stack top and use that as the new stack top if the frames match, else we create a new child
      let node: CallTreeNode;

      if (this.type === 'flamegraph') {
        const last = lastTop.children.find(c => c.frame === frame);
        if (last) {
          node = last;
        } else {
          node = new CallTreeNode(frame, lastTop);
          lastTop.children.push(node);
        }
      } else {
        const last = lastTop.children[lastTop.children.length - 1];
        if (last && !last.isLocked() && last.frame === frame) {
          node = last;
        } else {
          node = new CallTreeNode(frame, lastTop);
          lastTop.children.push(node);
        }
      }

      // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack with their respective indexes
      // We check the stack in a top-down order to find the first recursive frame.
      let start = this.calltree.length - 1;
      while (start >= 0) {
        if (this.calltree[start]!.frame === node.frame) {
          // The recursion edge is bidirectional
          this.calltree[start]!.recursive = node;
          node.recursive = this.calltree[start]!;
          break;
        }
        start--;
      }

      this.calltree.push(node);
    }

    this.stack.push(frame);
    this.lastValue = at;
  }

  leaveFrame(_event: Frame, at: number): void {
    this.addWeightToFrames(at);
    this.addWeightsToNodes(at);
    this.trackSampleStats(at);

    const leavingStackTop = this.calltree.pop();

    if (leavingStackTop === undefined) {
      throw new Error('Unbalanced stack');
    }

    // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.
    leavingStackTop.lock();
    const sampleDelta = at - this.lastValue;

    leavingStackTop.count += Math.ceil(
      leavingStackTop.totalWeight / this.samplingIntervalApproximation
    );

    if (sampleDelta > 0) {
      this.samples.push(leavingStackTop);
      this.weights.push(sampleDelta);
      // Keep track of the minFrameDuration
      this.minFrameDuration = Math.min(sampleDelta, this.minFrameDuration);
    }

    this.stack.pop();
    this.lastValue = at;
  }

  build(): EventedProfile {
    if (this.calltree.length > 1) {
      throw new Error('Unbalanced append order stack');
    }

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
