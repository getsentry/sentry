import {ColorChannels, FlamegraphTheme} from './flamegraph/flamegraphTheme';
import {relativeChange} from './units/units';
import {Flamegraph} from './flamegraph';
import {FlamegraphFrame} from './flamegraphFrame';

function countFrameOccurences(frames: FlamegraphFrame[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const frame of frames) {
    const key = frame.frame.name + (frame.frame.file ? frame.frame.file : '');

    if (counts.has(key)) {
      counts.set(key, counts.get(key)! + 1);
    } else {
      counts.set(key, 1);
    }
  }

  return counts;
}

export class DifferentialFlamegraph extends Flamegraph {
  colors: Map<string, ColorChannels> = new Map();
  fromToDiff: Map<string, number> = new Map();
  toCount: Map<string, number> = new Map();
  fromCount: Map<string, number> = new Map();

  static Diff(
    from: Flamegraph, // Reference chart is the one we compare the new flamegraph with
    to: Flamegraph,
    theme: FlamegraphTheme
  ): DifferentialFlamegraph {
    const differentialFlamegraph = new DifferentialFlamegraph(
      to.profile,
      to.profileIndex,
      {inverted: from.inverted, leftHeavy: from.leftHeavy}
    );

    const fromCounts = countFrameOccurences(from.frames);
    const toCounts = countFrameOccurences(to.frames);

    const countDiff: Map<string, number> = new Map();
    const colorMap: Map<string, ColorChannels> =
      differentialFlamegraph.colors ?? new Map();

    for (const frame of to.frames) {
      const key = frame.frame.name + (frame.frame.file ? frame.frame.file : '');

      // If we already diffed this frame, skip it
      if (countDiff.has(key)) {
        continue;
      }

      const fromCount = fromCounts.get(key);
      const toCount = toCounts.get(key);

      let diff = 0;
      let color: number[] = [];

      if (toCount === undefined) {
        throw new Error(`Missing count for frame ${key}, this should never happen`);
      }

      if (fromCount === undefined) {
        diff = 1;
        color = [...theme.COLORS.DIFFERENTIAL_INCREASE, 1];
      } else if (toCount > fromCount) {
        diff = relativeChange(toCount, fromCount);
        color = [...theme.COLORS.DIFFERENTIAL_INCREASE, diff];
      } else if (fromCount > toCount) {
        diff = relativeChange(toCount, fromCount);
        color = [...theme.COLORS.DIFFERENTIAL_DECREASE, Math.abs(diff)];
      } else {
        countDiff.set(key, diff);
        continue;
      }

      countDiff.set(key, diff);
      colorMap.set(key, color as ColorChannels);
    }

    differentialFlamegraph.fromToDiff = countDiff;
    differentialFlamegraph.toCount = toCounts;
    differentialFlamegraph.fromCount = fromCounts;

    differentialFlamegraph.colors = colorMap;

    return differentialFlamegraph;
  }
}
