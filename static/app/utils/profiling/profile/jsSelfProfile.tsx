import {lastOfArray} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame} from 'sentry/utils/profiling/frame';

import {stackMarkerToHumanReadable} from './../formatters/stackMarkerToHumanReadable';
import {resolveJSSelfProfilingStack} from './../jsSelfProfiling';
import {Profile} from './profile';
import {createFrameIndex} from './utils';

export class JSSelfProfile extends Profile {
  static FromProfile(profile: JSSelfProfiling.Trace): JSSelfProfile {
    const frameIndex = createFrameIndex(profile.frames, profile);
    // In the case of JSSelfProfiling, we need to index the abstract marker frames
    // as they will otherwise not be present in the ProfilerStack.
    const markers: JSSelfProfiling.Marker[] = [
      'gc',
      'layout',
      'other',
      'paint',
      'script',
      'style',
    ];

    for (const marker of markers) {
      frameIndex[marker] = new Frame({
        key: marker,
        name: stackMarkerToHumanReadable(marker),
        line: undefined,
        column: undefined,
        is_application: false,
      });
    }

    const startedAt = profile.samples[0].timestamp;
    const endedAt = lastOfArray(profile.samples).timestamp;

    const jsSelfProfile = new JSSelfProfile(
      endedAt - startedAt,
      startedAt,
      endedAt,
      'JSSelfProfiling',
      'milliseconds'
    );

    for (let i = 0; i < profile.samples.length; i++) {
      const stack = resolveJSSelfProfilingStack(
        profile,
        profile.samples[i].stackId,
        frameIndex,
        profile.samples[i].marker
      );

      const time = profile.samples[i - 1]?.timestamp ?? startedAt;
      jsSelfProfile.appendSample(stack, profile.samples[i].timestamp - time);
    }

    return jsSelfProfile.build();
  }

  appendSample(stack: Frame[], weight: number): void {
    let node = this.appendOrderTree;
    const framesInStack: CallTreeNode[] = [];

    for (const frame of stack) {
      const last = lastOfArray(node.children);

      if (last && !last.isLocked() && last.frame === frame) {
        node = last;
      } else {
        const parent = node;
        node = new CallTreeNode(frame, node);
        parent.children.push(node);
      }

      node.addToTotalWeight(weight);

      let start = framesInStack.length - 1;

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

    if (weight > 0) {
      this.minFrameDuration = Math.min(weight, this.minFrameDuration);
    }

    for (const child of node.children) {
      child.lock();
    }

    node.frame.addToSelfWeight(weight);

    for (const stackNode of framesInStack) {
      stackNode.frame.addToTotalWeight(weight);
    }

    if (node === lastOfArray(this.samples)) {
      this.weights[this.weights.length - 1] += weight;
    } else {
      this.samples.push(node);
      this.weights.push(weight);
    }
  }

  build(): JSSelfProfile {
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
