import {ColorChannels, FlamegraphTheme, LCH} from '../flamegraph/flamegraphTheme';
import {FlamegraphFrame} from '../flamegraphFrame';

const uniqueBy = <T,>(arr: ReadonlyArray<T>, predicate: (t: T) => unknown): Array<T> => {
  const cb = typeof predicate === 'function' ? predicate : (o: T) => o[predicate];

  return [
    ...arr
      .reduce((map, item) => {
        const key = item === null || item === undefined ? item : cb(item);

        if (key === undefined || key === null) {
          return map;
        }
        map.has(key) || map.set(key, item);

        return map;
      }, new Map())
      .values(),
  ];
};

// https://en.wikipedia.org/wiki/HSL_and_HSV#From_luma/chroma/hue
export const fract = (x: number): number => x - Math.floor(x);
export const triangle = (x: number): number => 2.0 * Math.abs(fract(x) - 0.5) - 1.0;
export function fromLumaChromaHue(L: number, C: number, H: number): ColorChannels {
  const hPrime = H / 60;
  const X = C * (1 - Math.abs((hPrime % 2) - 1));
  const [R1, G1, B1] =
    hPrime < 1
      ? [C, X, 0]
      : hPrime < 2
      ? [X, C, 0]
      : hPrime < 3
      ? [0, C, X]
      : hPrime < 4
      ? [0, X, C]
      : hPrime < 5
      ? [X, 0, C]
      : [C, 0, X];

  const m = L - (0.3 * R1 + 0.59 * G1 + 0.11 * B1);

  return [clamp(R1 + m, 0, 1), clamp(G1 + m, 0, 1), clamp(B1 + m, 0, 1.0)];
}

export const makeStackToColor = (
  fallback: [number, number, number, number]
): FlamegraphTheme['COLORS']['STACK_TO_COLOR'] => {
  return (
    frames: ReadonlyArray<FlamegraphFrame>,
    colorMap: FlamegraphTheme['COLORS']['COLOR_MAP'],
    colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
  ) => {
    const colors = colorMap(frames, colorBucket);
    const length = frames.length;

    // Length * number of frames * color components
    const colorBuffer: number[] = new Array(length * 4 * 6);

    for (let index = 0; index < length; index++) {
      const c = colors.get(frames[index].key);
      const colorWithAlpha = c ? c.concat(1) : fallback;

      for (let i = 0; i < 6; i++) {
        const offset = index * 6 * 4 + i * 4;
        colorBuffer[offset] = colorWithAlpha[0];
        colorBuffer[offset + 1] = colorWithAlpha[1];
        colorBuffer[offset + 2] = colorWithAlpha[2];
        colorBuffer[offset + 3] = colorWithAlpha[3];
      }
    }

    return {
      colorBuffer,
      colorMap: colors,
    };
  };
};

export const isNumber = (input: unknown): input is number => {
  return typeof input === 'number' && !isNaN(input);
};

export function clamp(number: number, min?: number, max?: number): number {
  if (!isNumber(min) && !isNumber(max)) {
    throw new Error('Clamp requires at least a min or max parameter');
  }

  if (isNumber(min) && isNumber(max)) {
    return number < min ? min : number > max ? max : number;
  }

  if (isNumber(max)) {
    return number > max ? max : number;
  }

  if (isNumber(min)) {
    return number < min ? min : number;
  }

  throw new Error('Unreachable case detected');
}

export function toRGBAString(r: number, g: number, b: number, alpha: number): string {
  return `rgba(${clamp(r * 255, 0, 255)}, ${clamp(g * 255, 0, 255)}, ${clamp(
    b * 255,
    0,
    255
  )}, ${alpha})`;
}

export function defaultFrameSortKey(frame: FlamegraphFrame): string {
  return frame.frame.name + (frame.frame.file || '');
}

function defaultFrameSort(a: FlamegraphFrame, b: FlamegraphFrame): number {
  return defaultFrameSortKey(a) > defaultFrameSortKey(b) ? 1 : -1;
}

export const makeColorBucketTheme = (lch: LCH) => {
  return (t: number): ColorChannels => {
    const x = triangle(30.0 * t);
    const H = 360.0 * (0.9 * t);
    const C = lch.C_0 + lch.C_d * x;
    const L = lch.L_0 - lch.L_d * x;
    return fromLumaChromaHue(L, C, H);
  };
};

export const makeColorMap = (
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
  sortBy: (a: FlamegraphFrame, b: FlamegraphFrame) => number = defaultFrameSort
): Map<FlamegraphFrame['frame']['key'], ColorChannels> => {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();

  const sortedFrames = [...frames].sort(sortBy);
  const length = sortedFrames.length;

  for (let i = 0; i < length; i++) {
    colors.set(
      sortedFrames[i].key,
      colorBucket(Math.floor((255 * i) / frames.length) / 256, sortedFrames[i].frame)
    );
  }

  return colors;
};

export const makeColorMapByRecursion = (
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> => {
  const colors = new Map<FlamegraphFrame['frame']['key'], ColorChannels>();

  const sortedFrames = [...frames]
    .sort((a, b) => a.frame.name.localeCompare(b.frame.name))
    .filter(f => f.node.isRecursive());

  const colorsByName = new Map<FlamegraphFrame['frame']['key'], ColorChannels>();

  for (let i = 0; i < sortedFrames.length; i++) {
    const frame = sortedFrames[i];
    const nameKey = frame.frame.name + frame.frame.file ?? '';

    if (!colorsByName.has(nameKey)) {
      const color = colorBucket(
        Math.floor((255 * i) / sortedFrames.length) / 256,
        frame.frame
      );

      colorsByName.set(nameKey, color);
    }

    colors.set(frame.key, colorsByName.get(nameKey)!);
  }

  return colors;
};

export const makeColorMapByImage = (
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> => {
  const colors = new Map<FlamegraphFrame['frame']['key'], ColorChannels>();

  const reverseFrameToImageIndex: Record<string, FlamegraphFrame[]> = {};

  const uniqueFrames = uniqueBy(frames, f => f.frame.image);
  const sortedFrames = [...uniqueFrames].sort((a, b) =>
    (a.frame.image ?? '') > (b.frame.image ?? '') ? 1 : -1
  );

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const key = frame.frame.image ?? '';

    if (!reverseFrameToImageIndex[key]) {
      reverseFrameToImageIndex[key] = [];
    }
    reverseFrameToImageIndex[key].push(frame);
  }

  for (let i = 0; i < sortedFrames.length; i++) {
    const imageFrames = reverseFrameToImageIndex[sortedFrames[i]?.frame?.image ?? ''];

    for (let j = 0; j < imageFrames.length; j++) {
      colors.set(
        imageFrames[j].key,
        colorBucket(
          Math.floor((255 * i) / sortedFrames.length) / 256,
          imageFrames[j].frame
        )
      );
    }
  }

  return colors;
};

export const makeColorMapBySystemVsApplication = (
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> => {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (frame.frame.is_application) {
      colors.set(frame.key, colorBucket(0.7, frame.frame));
      continue;
    }

    colors.set(frame.key, colorBucket(0.09, frame.frame));
  }

  return colors;
};
