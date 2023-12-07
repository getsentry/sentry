import {makeColorBuffer} from 'sentry/utils/profiling/colors/utils';

import {ColorChannels, FlamegraphTheme} from './flamegraph/flamegraphTheme';
import {Profile} from './profile/profile';
import {Flamegraph} from './flamegraph';
import {FlamegraphFrame} from './flamegraphFrame';

function makeFrameMap(frames: ReadonlyArray<FlamegraphFrame>): Map<string, number> {
  const counts = new Map<string, number>();

  for (const frame of frames) {
    const key = DifferentialFlamegraph.FrameKey(frame);
    counts.set(key, frame.node.selfWeight + (counts.get(key) ?? 0));
  }

  return counts;
}

export class DifferentialFlamegraph extends Flamegraph {
  colors: Map<string, ColorChannels> = new Map();
  colorBuffer: number[] = [];

  beforeCounts: Map<string, number> = new Map();
  afterCounts: Map<string, number> = new Map();

  newFrames: FlamegraphFrame[] = [];
  increasedFrames: [number, FlamegraphFrame][] = [];
  decreasedFrames: [number, FlamegraphFrame][] = [];

  static ALPHA_SCALING = 0.8;

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

    const colorMap = new Map<string, ColorChannels>();

    const beforeCounts = makeFrameMap(before.frames);
    const afterCounts = makeFrameMap(after.frames);

    const newFrames: FlamegraphFrame[] = [];
    const increasedFrames: [number, FlamegraphFrame][] = [];
    const decreasedFrames: [number, FlamegraphFrame][] = [];

    const INCREASED_FRAME_COLOR = theme.COLORS.DIFFERENTIAL_INCREASE;
    const DECREASED_FRAME_COLOR = theme.COLORS.DIFFERENTIAL_DECREASE;
    let NEW_FRAME_COLOR = INCREASED_FRAME_COLOR.concat(
      1 * DifferentialFlamegraph.ALPHA_SCALING
    );
    const REMOVED_FRAME_COLOR = DECREASED_FRAME_COLOR.concat(
      1 * DifferentialFlamegraph.ALPHA_SCALING
    );

    if (negated) {
      NEW_FRAME_COLOR = REMOVED_FRAME_COLOR;
    }

    // Keep track of max increase and decrease so that we can
    // scale the colors accordingly to the max value
    let maxIncrease = 0;
    let maxDecrease = 0;

    for (const frame of sourceFlamegraph.frames) {
      const key = DifferentialFlamegraph.FrameKey(frame);

      const beforeCount = beforeCounts.get(key);
      const afterCount = afterCounts.get(key);

      // In a negated view, frames missing in the after state are new frames
      if (afterCount === undefined && negated) {
        newFrames.push(frame);
        continue;
      }

      if (afterCount === undefined) {
        throw new Error(`Missing count for frame ${key}, this should never happen`);
      }

      // In a non-negated view, frames missing in the before state are new frames
      if (beforeCount === undefined) {
        newFrames.push(frame);
        continue;
      }

      // If frames have same count, we don't need to color them
      if (beforeCount === afterCount) {
        continue;
      }

      // If the frame count increased, color it red
      if (afterCount > beforeCount) {
        if (afterCount - beforeCount > maxIncrease) {
          maxIncrease = afterCount - beforeCount;
        }
        increasedFrames.push([afterCount - beforeCount, frame]);
        continue;
      }

      // If the frame count decreased, color it blue
      if (beforeCount > afterCount) {
        if (beforeCount - afterCount > maxDecrease) {
          maxDecrease = beforeCount - afterCount;
        }
        decreasedFrames.push([beforeCount - afterCount, frame]);
        continue;
      }
    }

    for (const frame of newFrames) {
      colorMap.set(
        DifferentialFlamegraph.FrameKey(frame),
        NEW_FRAME_COLOR as ColorChannels
      );
    }

    for (const frame of increasedFrames) {
      colorMap.set(
        DifferentialFlamegraph.FrameKey(frame[1]),
        INCREASED_FRAME_COLOR.concat(
          (frame[0] / maxIncrease) * DifferentialFlamegraph.ALPHA_SCALING
        ) as ColorChannels
      );
    }

    for (const frame of decreasedFrames) {
      colorMap.set(
        DifferentialFlamegraph.FrameKey(frame[1]),
        DECREASED_FRAME_COLOR.concat(
          (frame[0] / maxDecrease) * DifferentialFlamegraph.ALPHA_SCALING
        ) as ColorChannels
      );
    }

    differentialFlamegraph.colors = colorMap;
    differentialFlamegraph.colorBuffer = makeColorBuffer(
      sourceFlamegraph.frames,
      colorMap,
      theme.COLORS.FRAME_FALLBACK_COLOR as unknown as ColorChannels,
      DifferentialFlamegraph.FrameKey
    );

    differentialFlamegraph.newFrames = newFrames;
    differentialFlamegraph.increasedFrames = increasedFrames;
    differentialFlamegraph.decreasedFrames = decreasedFrames;
    differentialFlamegraph.beforeCounts = beforeCounts;
    differentialFlamegraph.afterCounts = afterCounts;

    return differentialFlamegraph;
  }
}
