import {lastOfArray} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame} from 'sentry/utils/profiling/frame';

import {stackMarkerToHumanReadable} from './../formatters/stackMarkerToHumanReadable';
import {resolveJSSelfProfilingStack} from './../jsSelfProfiling';
import {Profile} from './profile';
import {createFrameIndex} from './utils';

function sortJSSelfProfileSamples(samples: Readonly<JSSelfProfiling.Trace['samples']>) {
  return [...samples].sort((a, b) => {
    return a.stackId - b.stackId;
  });
}
export class JSSelfProfile extends Profile {
  static FromProfile(
    profile: JSSelfProfiling.Trace,
    frameIndex: ReturnType<typeof createFrameIndex>,
    options: {type: 'flamechart' | 'flamegraph'}
  ): JSSelfProfile {
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
      frameIndex[marker] = new Frame(
        {
          key: marker,
          name: stackMarkerToHumanReadable(marker),
          line: undefined,
          column: undefined,
          is_application: false,
        },
        'web'
      );
    }

    const startedAt = profile.samples[0].timestamp;
    const endedAt = lastOfArray(profile.samples).timestamp;

    const jsSelfProfile = new JSSelfProfile({
      duration: endedAt - startedAt,
      startedAt,
      endedAt,
      name: 'JSSelfProfiling',
      unit: 'milliseconds',
      threadId: 0,
      type: options.type,
    });

    const samples =
      options.type === 'flamegraph'
        ? sortJSSelfProfileSamples(profile.samples)
        : profile.samples;

    if (options.type === 'flamechart') {
      // Because JS self profiling takes an initial sample when we call new Profiler(),
      // it means that the first sample weight will always be zero. We want to append the sample with 0 weight,
      //  because the 2nd sample may part of the first sample's stack. This way we keep the most information we can of the stack trace
      jsSelfProfile.appendSample(
        resolveJSSelfProfilingStack(
          profile,
          profile.samples[0].stackId,
          frameIndex,
          profile.samples[0].marker
        ),
        0
      );
    }

    // We start at stack 1, because we've already appended stack 0 above. The weight of each sample is the
    // difference between the current sample and the previous one.
    for (let i = 1; i < samples.length; i++) {
      // When gc is triggered, the stack may be indicated as empty. In that case, the thread was not idle
      // and we should append gc to the top of the previous stack.
      // https://github.com/WICG/js-self-profiling/issues/59
      if (samples[i].marker === 'gc' && options.type === 'flamechart') {
        jsSelfProfile.appendSample(
          resolveJSSelfProfilingStack(
            profile,
            // use the previous sample
            samples[i - 1].stackId,
            frameIndex,
            samples[i].marker
          ),
          samples[i].timestamp - samples[i - 1].timestamp
        );
      } else {
        jsSelfProfile.appendSample(
          resolveJSSelfProfilingStack(
            profile,
            samples[i].stackId,
            frameIndex,
            samples[i].marker
          ),
          samples[i].timestamp - samples[i - 1].timestamp
        );
      }
    }

    return jsSelfProfile.build();
  }

  appendSample(stack: Frame[], weight: number): void {
    this.trackSampleStats(weight);

    let node = this.callTree;
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

      node.totalWeight += weight;

      // TODO: This is On^2, because we iterate over all frames in the stack to check if our
      // frame is a recursive frame. We could do this in O(1) by keeping a map of frames in the stack
      // We check the stack in a top-down order to find the first recursive frame.
      let stackHeight = framesInStack.length - 1;

      while (stackHeight >= 0) {
        if (framesInStack[stackHeight].frame === node.frame) {
          // The recursion edge is bidirectional
          framesInStack[stackHeight].recursive = node;
          node.recursive = framesInStack[stackHeight];
          break;
        }
        stackHeight--;
      }

      framesInStack.push(node);
    }

    node.selfWeight += weight;

    if (weight > 0) {
      this.minFrameDuration = Math.min(weight, this.minFrameDuration);
    }

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
