import {makeColorBuffer} from 'sentry/utils/profiling/colors/utils';

import {ColorChannels, FlamegraphTheme} from './flamegraph/flamegraphTheme';
import {Profile} from './profile/profile';
import {Flamegraph, sortFlamegraphAlphabetically} from './flamegraph';
import {FlamegraphFrame} from './flamegraphFrame';

export class DifferentialFlamegraph extends Flamegraph {
  colors: Map<FlamegraphFrame['node'], ColorChannels> = new Map();
  colorBuffer: number[] = [];

  isDifferentialFlamegraph: boolean = true;

  newFrames: FlamegraphFrame[] = [];
  removedFrames: FlamegraphFrame[] = [];
  increasedFrames: FlamegraphFrame[] = [];
  decreasedFrames: FlamegraphFrame[] = [];

  static ALPHA_SCALING = 0.8;
  public negated: boolean = false;

  weights: Map<FlamegraphFrame['node'], {after: number; before: number}> = new Map();

  static FrameKey(frame: FlamegraphFrame): string {
    return (
      frame.frame.name +
      (frame.frame.file ?? '') +
      (frame.frame.path ?? '') +
      (frame.frame.module ?? '') +
      (frame.frame.package ?? '')
    );
  }

  static Empty(): DifferentialFlamegraph {
    return new DifferentialFlamegraph(Profile.Empty, {
      inverted: false,
      sort: 'call order',
    });
  }

  static FromDiff(
    {before, after}: {after: Flamegraph; before: Flamegraph},
    // When drawing a negated view, the differential flamegraph renders the flamegraph
    // of the previous state, with the colors of the after state. This way we can see
    // how the exectution of the program changed, i.e. see into the future.
    {negated}: {negated: boolean},
    theme: FlamegraphTheme
  ): DifferentialFlamegraph {
    const sourceFlamegraph = negated ? before : after;

    const differentialFlamegraph = new DifferentialFlamegraph(sourceFlamegraph.profile, {
      inverted: after.inverted,
      sort: after.sort,
    });

    const colorMap = new Map<FlamegraphFrame['node'], ColorChannels>();
    const increasedFrames: FlamegraphFrame[] = [];
    const decreasedFrames: FlamegraphFrame[] = [];

    const INCREASED_FRAME_COLOR = theme.COLORS.DIFFERENTIAL_INCREASE;
    const DECREASED_FRAME_COLOR = theme.COLORS.DIFFERENTIAL_DECREASE;
    const NEW_FRAME_COLOR = INCREASED_FRAME_COLOR.concat(
      1 * DifferentialFlamegraph.ALPHA_SCALING
    );
    const REMOVED_FRAME_COLOR = DECREASED_FRAME_COLOR.concat(
      1 * DifferentialFlamegraph.ALPHA_SCALING
    );

    // Keep track of max increase and decrease so that we can
    // scale the colors accordingly to the max value
    let maxIncrease = 0;
    let maxDecrease = 0;

    const {weights, addedFrames, removedFrames} = diffFlamegraphTreeRecursive(
      before,
      after,
      negated
    );
    for (const frame of sourceFlamegraph.frames) {
      const change = weights.get(frame.node);

      // If frames have same count, we don't need to color them
      if (!change) {
        continue;
      }

      // If the frame count increased, color it red
      if (change.after > change.before) {
        maxIncrease = Math.max(maxIncrease, change.after - change.before);
        increasedFrames.push(frame);
        continue;
      }

      // If the frame count decreased, color it blue
      if (change.after < change.before) {
        maxDecrease = Math.min(maxDecrease, change.after - change.before);
        decreasedFrames.push(frame);
        continue;
      }
    }

    for (const frame of addedFrames) {
      colorMap.set(frame.node, NEW_FRAME_COLOR as ColorChannels);
    }

    for (const frame of removedFrames) {
      colorMap.set(frame.node, REMOVED_FRAME_COLOR as ColorChannels);
    }

    for (const frame of increasedFrames) {
      const {before: beforeCount, after: afterCount} = weights.get(frame.node)!;

      colorMap.set(
        frame.node,
        INCREASED_FRAME_COLOR.concat(
          ((afterCount - beforeCount) / maxIncrease) *
            DifferentialFlamegraph.ALPHA_SCALING
        ) as ColorChannels
      );
    }

    for (const frame of decreasedFrames) {
      const {before: beforeCount, after: afterCount} = weights.get(frame.node)!;

      colorMap.set(
        frame.node,
        DECREASED_FRAME_COLOR.concat(
          ((afterCount - beforeCount) / maxDecrease) *
            DifferentialFlamegraph.ALPHA_SCALING
        ) as ColorChannels
      );
    }

    differentialFlamegraph.colors = colorMap;
    differentialFlamegraph.colorBuffer = makeColorBuffer(
      sourceFlamegraph.frames,
      colorMap,
      theme.COLORS.FRAME_FALLBACK_COLOR as unknown as ColorChannels
    );

    differentialFlamegraph.newFrames = addedFrames;
    differentialFlamegraph.removedFrames = removedFrames;
    differentialFlamegraph.increasedFrames = increasedFrames;
    differentialFlamegraph.decreasedFrames = decreasedFrames;
    differentialFlamegraph.weights = weights;
    differentialFlamegraph.negated = negated;

    return differentialFlamegraph;
  }
}

export function diffFlamegraphTreeRecursive(
  beforeFlamegraph: Flamegraph,
  afterFlamegraph: Flamegraph,
  negated
): {
  addedFrames: FlamegraphFrame[];
  removedFrames: FlamegraphFrame[];
  weights: Map<FlamegraphFrame['node'], {after: number; before: number}>;
} {
  let removedFrames: FlamegraphFrame[] = [];
  let addedFrames: FlamegraphFrame[] = [];
  const weights = new Map<FlamegraphFrame['node'], {after: number; before: number}>();

  function visit(beforeNode: FlamegraphFrame, afterNode: FlamegraphFrame) {
    const node = negated ? beforeNode : afterNode;
    weights.set(node.node, {
      before: beforeNode.node.totalWeight,
      after: afterNode.node.totalWeight,
    });

    for (let i = 0; i < afterNode.children.length; i++) {
      for (let j = 0; j < beforeNode.children.length; j++) {
        const result = compareFrames(beforeNode.children[j], afterNode.children[i]);
        if (result === 0) {
          visit(beforeNode.children[j], afterNode.children[i]);
          break;
        }
        if (result === -1) {
          // removed frame
          removedFrames = removedFrames.concat(getTreeNodes(beforeNode.children[j]));
          continue;
        }
        if (result === 1) {
          // added frame
          addedFrames = addedFrames.concat(getTreeNodes(afterNode.children[i]));
          break;
        }
      }
    }
  }

  visit(beforeFlamegraph.root, afterFlamegraph.root);

  return {weights, removedFrames, addedFrames};
}

function getTreeNodes(frame: FlamegraphFrame): FlamegraphFrame[] {
  const frames: FlamegraphFrame[] = [];
  const stack: FlamegraphFrame[] = [frame];

  while (stack.length > 0) {
    const node = stack.pop()!;
    frames.push(node);

    for (const child of node.children) {
      stack.push(child);
    }
  }

  return frames;
}

const compareFrames = (a: FlamegraphFrame, b: FlamegraphFrame) => {
  return sortFlamegraphAlphabetically(a.node, b.node);
};
