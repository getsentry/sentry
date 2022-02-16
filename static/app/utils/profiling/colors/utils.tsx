import {Frame} from '../frame';

import {ColorChannels, FlamegraphTheme, LCH} from './../flamegraph/FlamegraphTheme';

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
    frames: ReadonlyArray<Frame>,
    colorMap: FlamegraphTheme['COLORS']['COLOR_MAP'],
    colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
  ) => {
    const colors = colorMap(frames, colorBucket);

    const length = frames.length;

    // Length * number of frames * color components
    const colorBuffer: number[] = new Array(length * 4 * 6);

    for (let index = 0; index < length; index++) {
      const c = colors.get(
        frames[index].name + (frames[index].file ? frames[index].file : '')
      );
      const colorWithAlpha = c ? [...c, 1] : fallback;

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

export function defaultFrameSortKey(frame: Frame): string {
  return (frame.file || '') + frame.name;
}

function defaultFrameSort(a: Frame, b: Frame): number {
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
  frames: ReadonlyArray<Frame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
  sortBy: (a: Frame, b: Frame) => number = defaultFrameSort
): Map<Frame['key'], ColorChannels> => {
  const colors = new Map<Frame['key'], ColorChannels>();

  const sortedFrames = [...frames].sort(sortBy);
  const length = sortedFrames.length;

  for (let i = 0; i < length; i++) {
    colors.set(
      sortedFrames[i].name + (sortedFrames[i].file ? sortedFrames[i].file : ''),
      colorBucket(Math.floor((255 * i) / frames.length) / 256, sortedFrames[i])
    );
  }

  return colors;
};

export const makeColorMapByRecursion = (
  frames: ReadonlyArray<Frame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<Frame['key'], ColorChannels> => {
  const colors = new Map<Frame['key'], ColorChannels>();

  const sortedFrames = uniqueBy(
    frames.filter(f => f.recursive),
    defaultFrameSortKey
  );

  for (let i = 0; i < sortedFrames.length; i++) {
    const frame = sortedFrames[i];

    colors.set(
      frame.name + (frame.file ? frame.file : ''),
      colorBucket(Math.floor((255 * i) / sortedFrames.length) / 256, frame)
    );
  }

  return colors;
};

export const makeColorMapByImage = (
  frames: ReadonlyArray<Frame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<Frame['key'], ColorChannels> => {
  const colors = new Map<Frame['key'], ColorChannels>();

  const reverseFrameToImageIndex: Record<string, Frame[]> = {};

  const uniqueFrames = uniqueBy(frames, f => f.image);
  const sortedFrames = [...uniqueFrames].sort((a, b) =>
    (a.image ?? '') > (b.image ?? '') ? 1 : -1
  );

  for (const frame of frames) {
    const key = frame.image ?? '';

    if (!reverseFrameToImageIndex[key]) {
      reverseFrameToImageIndex[key] = [];
    }
    reverseFrameToImageIndex[key].push(frame);
  }

  for (let i = 0; i < sortedFrames.length; i++) {
    const imageFrames = reverseFrameToImageIndex[sortedFrames[i]?.image ?? ''];

    for (const frame of imageFrames) {
      colors.set(
        frame.name + (frame.file ? frame.file : ''),
        colorBucket(Math.floor((255 * i) / sortedFrames.length) / 256, frame)
      );
    }
  }

  return colors;
};
