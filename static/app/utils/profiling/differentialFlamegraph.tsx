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
    theme: FlamegraphTheme
  ): DifferentialFlamegraph {
    const differentialFlamegraph = new DifferentialFlamegraph(after.profile, {
      inverted: after.inverted,
      sort: after.sort,
    });

    const colorMap = new Map<string, ColorChannels>();

    const beforeCounts = makeFrameMap(before.frames);
    const afterCounts = makeFrameMap(after.frames);

    const newFrames: FlamegraphFrame[] = [];
    const increasedFrames: [number, FlamegraphFrame][] = [];
    const decreasedFrames: [number, FlamegraphFrame][] = [];

    // @TODO do we want to show removed frames?
    // This would require iterating over the entire
    // before frame list and checking if the frame is
    // still present in the after frame list

    // Keep track of max increase and decrease so that we can
    // scale the colors accordingly to the max value
    let maxIncrease = 0;
    let maxDecrease = 0;

    for (const frame of after.frames) {
      const key = DifferentialFlamegraph.FrameKey(frame);

      const beforeCount = beforeCounts.get(key);
      const afterCount = afterCounts.get(key);

      if (afterCount === undefined) {
        throw new Error(`Missing count for frame ${key}, this should never happen`);
      }

      if (beforeCount === undefined) {
        newFrames.push(frame);
      } else if (afterCount > beforeCount) {
        if (afterCount - beforeCount > maxIncrease) {
          maxIncrease = afterCount - beforeCount;
        }
        increasedFrames.push([afterCount - beforeCount, frame]);
      } else if (beforeCount > afterCount) {
        if (beforeCount - afterCount > maxDecrease) {
          maxDecrease = beforeCount - afterCount;
        }
        decreasedFrames.push([beforeCount - afterCount, frame]);
      }
    }

    for (const frame of newFrames) {
      colorMap.set(DifferentialFlamegraph.FrameKey(frame), [
        ...theme.COLORS.DIFFERENTIAL_INCREASE,
        0.8,
      ] as ColorChannels);
    }

    for (const frame of increasedFrames) {
      colorMap.set(DifferentialFlamegraph.FrameKey(frame[1]), [
        ...theme.COLORS.DIFFERENTIAL_INCREASE,
        (frame[0] / maxIncrease) * 0.8,
      ] as ColorChannels);
    }

    for (const frame of decreasedFrames) {
      colorMap.set(DifferentialFlamegraph.FrameKey(frame[1]), [
        ...theme.COLORS.DIFFERENTIAL_DECREASE,
        (frame[0] / maxDecrease) * 0.8,
      ] as ColorChannels);
    }

    differentialFlamegraph.colors = colorMap;
    differentialFlamegraph.colorBuffer = makeColorBuffer(
      after.frames,
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
