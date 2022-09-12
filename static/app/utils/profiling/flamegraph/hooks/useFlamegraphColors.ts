import {Flamegraph} from '../../flamegraph';
import {FlamegraphFrame} from '../../flamegraphFrame';
import {ColorChannels, FlamegraphTheme} from '../flamegraphTheme';

export function useFlamegraphColors(
  theme: FlamegraphTheme,
  ...flamegraphs: Flamegraph[]
): {colorBuffer: number[]; colorMap: Map<string | number, ColorChannels>} {
  const frames = flamegraphs.reduce<FlamegraphFrame[]>((acc, flamegraph) => {
    return acc.concat(flamegraph.frames);
  }, []);

  // Generate colors for the flamegraph
  const {colorBuffer, colorMap} = theme.COLORS.STACK_TO_COLOR(
    frames,
    theme.COLORS.COLOR_MAP,
    theme.COLORS.COLOR_BUCKET
  );

  return {colorBuffer, colorMap};
}
