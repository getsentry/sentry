import {lastOfArray} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame} from 'sentry/utils/profiling/frame';

import {Profile} from './profile';
import {createFrameIndex} from './utils';

export class EventedProfile extends Profile {
  appendOrderStack: CallTreeNode[] = [this.appendOrderTree];
  stack: Frame[] = [];

  lastValue = 0;

  static FromProfile(
    eventedProfile: Profiling.EventedProfile,
    frameIndex: ReturnType<typeof createFrameIndex>
  ): EventedProfile {
    const {startValue, endValue, name, unit} = eventedProfile;

    const profile = new EventedProfile(
      endValue - startValue,
      startValue,
      endValue,
      name,
      unit
    );

    // If frames are offset, we need to set lastValue to profile start, so that delta between
    // samples is correctly offset by the start value.
    profile.lastValue = startValue;

    for (const event of eventedProfile.events) {
      const frame = frameIndex[event.frame];

      if (!frame) {
        throw new Error(`Cannot retrieve event: ${event.frame} from frame index`);
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

    return profile.build();
  }

  addWeightToFrames(weight: number): void {
    const weightDelta = weight - this.lastValue;

    for (const frame of this.stack) {
      frame.addToTotalWeight(weightDelta);
    }

    const top = lastOfArray(this.stack);
    if (top) {
      top.addToSelfWeight(weight);
    }
  }

  addWeightsToNodes(value: number) {
    const delta = value - this.lastValue;

    for (const node of this.appendOrderStack) {
      node.addToTotalWeight(delta);
    }
    const stackTop = lastOfArray(this.appendOrderStack);

    if (stackTop) {
      stackTop.addToSelfWeight(delta);
    }
  }

  enterFrame(frame: Frame, at: number): void {
    this.addWeightToFrames(at);
    this.addWeightsToNodes(at);

    const lastTop = lastOfArray(this.appendOrderStack);

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

      const last = lastOfArray(lastTop.children);
      let node: CallTreeNode;

      if (last && !last.isLocked() && last.frame === frame) {
        node = last;
      } else {
        node = new CallTreeNode(frame, lastTop);
        lastTop.children.push(node);
      }

      // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack with their respective indexes
      // We check the stack in a top-down order to find the first recursive frame.
      let start = this.appendOrderStack.length - 1;
      while (start >= 0) {
        if (this.appendOrderStack[start].frame === node.frame) {
          // The recursion edge is bidirectional
          this.appendOrderStack[start].setRecursive(node);
          node.setRecursive(this.appendOrderStack[start]);
          break;
        }
        start--;
      }

      this.appendOrderStack.push(node);
    }

    this.stack.push(frame);
    this.lastValue = at;
  }

  leaveFrame(_event: Frame, at: number): void {
    this.addWeightToFrames(at);
    this.addWeightsToNodes(at);

    const leavingStackTop = this.appendOrderStack.pop();

    if (leavingStackTop === undefined) {
      throw new Error('Unbalanced stack');
    }

    // Lock the stack node, so we make sure we dont mutate it in the future.
    // The samples should be ordered by timestamp when processed so we should never
    // iterate over them again in the future.
    leavingStackTop.lock();
    const sampleDelta = at - this.lastValue;

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
    if (this.appendOrderStack.length > 1) {
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
