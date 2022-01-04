import {relativeChange} from './units/units';
import {Flamegraph} from './flamegraph';
import {FlamegraphFrame} from './flamegraphFrame';

function countFrameOccurences(frames: FlamegraphFrame[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const frame of frames) {
    const key = frame.frame.name + frame.frame.file;

    // @ts-ignore
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    else counts.set(key, 1);
  }

  return counts;
}

export class DifferentialFlamegraph extends Flamegraph {
  countDiff: Map<string, number> = new Map();
  count: Map<string, number> = new Map();
  referenceCount: Map<string, number> = new Map();

  static FromFlamegraphs(
    reference: Flamegraph, // Reference chart is the one we compare the new flamegraph with
    flamegraph: Flamegraph,
    theme: FlamegraphTheme
  ): DifferentialFlamegraph {
    const differentialFlamegraph = new DifferentialFlamegraph(
      flamegraph.profile,
      flamegraph.profileIndex,
      reference.inverted,
      reference.leftHeavy
    );

    const referenceCounts = countFrameOccurences(reference.frames);
    const counts = countFrameOccurences(flamegraph.frames);

    const countDiff: Map<string, number> = new Map();
    const colorMap: Map<string | number, number[]> =
      differentialFlamegraph.colors ?? new Map();

    for (const frame of flamegraph.frames) {
      const key = frame.frame.name + frame.frame.file;

      const count = counts.get(key);
      const referenceCount = referenceCounts.get(key);

      let diff = 0;
      let color: number[] = [];

      if (count === undefined) {
        diff = -1;
        color = [...theme.COLORS.DIFFERENTIAL_DECREASE, 1];
      } else if (referenceCount === undefined) {
        diff = 1;
        color = [...theme.COLORS.DIFFERENTIAL_INCREASE, 1];
      } else if (count > referenceCount) {
        diff = relativeChange(referenceCount, count);
        color = [
          ...theme.COLORS.DIFFERENTIAL_INCREASE,
          Math.abs((count - referenceCount) / count),
        ];
      } else if (referenceCount > count) {
        diff = relativeChange(referenceCount, count);
        color = [
          ...theme.COLORS.DIFFERENTIAL_DECREASE,
          Math.abs((count - referenceCount) / referenceCount),
        ];
      } else {
        countDiff.set(key, 0);
        continue;
      }

      countDiff.set(key, diff);
      colorMap.set(key, color);
    }

    differentialFlamegraph.countDiff = countDiff;
    differentialFlamegraph.count = counts;
    differentialFlamegraph.referenceCount = referenceCounts;

    differentialFlamegraph.setColors(colorMap);

    return differentialFlamegraph;
  }
}
