import {ColorChannels, FlamegraphTheme} from './flamegraph/flamegraphTheme';
import {Profile} from './profile/profile';
import {Flamegraph} from './flamegraph';
import {FlamegraphFrame} from './flamegraphFrame';

const frameDiffKey = (frame: FlamegraphFrame) => {
  return (
    frame.frame.name +
    (frame.frame.file ?? '') +
    (frame.frame.path ?? '') +
    (frame.frame.module ?? '') +
    (frame.frame.package ?? '')
  );
};

function makeFrameMap(frames: ReadonlyArray<FlamegraphFrame>): Map<string, number> {
  const counts = new Map<string, number>();

  for (const frame of frames) {
    counts.set(frameDiffKey(frame), frame.node.selfWeight);
  }

  return counts;
}

export class DifferentialFlamegraph extends Flamegraph {
  colors: Map<string, ColorChannels> = new Map();

  newFrames: [number, FlamegraphFrame][] = [];
  increasedFrames: [number, FlamegraphFrame][] = [];
  decreasedFrames: [number, FlamegraphFrame][] = [];

  static Empty(): DifferentialFlamegraph {
    return new DifferentialFlamegraph(Profile.Empty, 0, {
      inverted: false,
      sort: 'call order',
    });
  }

  static FromDiff(
    {before, current}: {before: Flamegraph; current: Flamegraph},
    theme: FlamegraphTheme
  ): DifferentialFlamegraph {
    const differentialFlamegraph = new DifferentialFlamegraph(
      current.profile,
      current.profileIndex,
      {inverted: current.inverted, sort: current.sort}
    );

    const colorMap = new Map<string, ColorChannels>();

    const beforeCounts = makeFrameMap(before.frames);
    const currentCounts = makeFrameMap(current.frames);

    const newFrames: [number, FlamegraphFrame][] = [];
    const increasedFrames: [number, FlamegraphFrame][] = [];
    const decreasedFrames: [number, FlamegraphFrame][] = [];

    // @TODO do we want to show removed frames?
    // This would require iterating over the entire
    // before frame list and checking if the frame is
    // still present in the current frame list

    // Keep track of max increase and decrease so that we can
    // scale the colors accordingly to the max value
    let maxIncrease = 0;
    let maxDecrease = 0;

    for (const frame of current.frames) {
      const key = frameDiffKey(frame);

      const beforeCount = beforeCounts.get(key);
      const currentCount = currentCounts.get(key);

      if (currentCount === undefined) {
        throw new Error(`Missing count for frame ${key}, this should never happen`);
      }

      if (beforeCount === undefined) {
        newFrames.push([1, frame]);
      } else if (currentCount > beforeCount) {
        if (currentCount - beforeCount > maxIncrease) {
          maxIncrease = currentCount - beforeCount;
        }
        increasedFrames.push([currentCount - beforeCount, frame]);
      } else if (beforeCount > currentCount) {
        if (beforeCount - currentCount > maxDecrease) {
          maxDecrease = beforeCount - currentCount;
        }
        decreasedFrames.push([beforeCount - currentCount, frame]);
      }
    }

    for (const frame of newFrames) {
      colorMap.set(frameDiffKey(frame[1]), [
        ...theme.COLORS.DIFFERENTIAL_INCREASE,
        1,
      ] as ColorChannels);
    }

    for (const frame of increasedFrames) {
      colorMap.set(frameDiffKey(frame[1]), [
        ...theme.COLORS.DIFFERENTIAL_INCREASE,
        frame[0] / maxIncrease,
      ] as ColorChannels);
    }

    for (const frame of decreasedFrames) {
      colorMap.set(frameDiffKey(frame[1]), [
        ...theme.COLORS.DIFFERENTIAL_DECREASE,
        frame[0] / maxDecrease,
      ] as ColorChannels);
    }

    differentialFlamegraph.colors = colorMap;
    differentialFlamegraph.newFrames = newFrames;
    differentialFlamegraph.increasedFrames = increasedFrames;
    differentialFlamegraph.decreasedFrames = decreasedFrames;

    return differentialFlamegraph;
  }
}
