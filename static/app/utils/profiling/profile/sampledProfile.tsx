import {lastOfArray} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';

import {Frame} from './../frame';
import {Profile} from './profile';
import {createFrameIndex} from './utils';

export class SampledProfile extends Profile {
  static FromProfile(sampled: Profiling.SampledProfile): Profile {
    const {startValue, endValue, samples, weights} = sampled;

    const sampledProfile = new SampledProfile(
      endValue - startValue,
      startValue,
      endValue,
      sampled.name,
      sampled.unit
    );

    const frameIndex = createFrameIndex(sampled.shared.frames);

    if (samples.length !== weights.length) {
      throw new Error(
        `Expected samples.length (${samples.length}) to equal weights.length (${weights.length})`
      );
    }

    for (let i = 0; i < samples.length; i++) {
      const stack = samples[i];
      const weight = weights[i];

      sampledProfile.appendSampleWithWeight(
        stack.map(n => frameIndex[n]),
        weight
      );
    }

    return sampledProfile.build();
  }

  appendSampleWithWeight(stack: Frame[], weight: number): void {
    // Ignore samples with 0 weight
    if (weight === 0) return;
    if (isNaN(weight)) throw new Error('invalid weight');

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

      let start = framesInStack.length - 1;
      // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack
      // We check the stack in a top-down order to find the first recursive frame.
      while (start >= 0) {
        if (framesInStack[start].frame === node.frame) {
          node.setRecursive(node);
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
