import {
  ColorChannels,
  ColorMapFn,
  FlamegraphTheme,
  LCH,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';

import {FlamegraphFrame} from '../flamegraphFrame';

function uniqueCountBy<T>(
  arr: ReadonlyArray<T>,
  predicate: (t: T) => string | boolean
): number {
  const visited = {};

  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    const key = predicate(arr[i]);

    if (key === true) {
      count++;
      continue;
    } else if (key === false) {
      continue;
    }

    if (visited[key]) {
      continue;
    }

    visited[key] = 1;
    count++;
  }
  return count;
}

function uniqueBy<T>(arr: ReadonlyArray<T>, predicate: (t: T) => unknown): Array<T> {
  const cb = typeof predicate === 'function' ? predicate : (o: T) => o[predicate];

  const seen = new Set();
  const set: Array<T> = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const key = item === null || item === undefined ? item : cb(item);

    if (key === undefined || key === null || seen.has(key)) {
      continue;
    }
    seen.add(key);
    set.push(item);
  }

  return set;
}

// These were taken from speedscope, originally described in
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

  const m = L - (0.35 * R1 + 0.35 * G1 + 0.35 * B1);

  return [clamp(R1 + m, 0, 1), clamp(G1 + m, 0, 1), clamp(B1 + m, 0, 1.0)];
}

export const makeStackToColor = (
  fallback: [number, number, number, number]
): FlamegraphTheme['COLORS']['STACK_TO_COLOR'] => {
  return (
    frames: ReadonlyArray<FlamegraphFrame>,
    generateColorMap: ColorMapFn,
    colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
    theme: FlamegraphTheme
  ) => {
    const colorMap = generateColorMap(frames, colorBucket, theme);
    const length = frames.length;

    // Length * number of frames * color components
    const colorBuffer: number[] = new Array(length * 4 * 6);

    for (let index = 0; index < length; index++) {
      const frame = frames[index];

      if (!frame) {
        continue;
      }

      const c = colorMap.get(frame.key);
      const colorWithAlpha: [number, number, number, number] =
        c && c.length === 3
          ? (c.concat(1) as [number, number, number, number])
          : c
          ? c
          : fallback;

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
      colorMap,
    };
  };
};

export function isNumber(input: unknown): input is number {
  return typeof input === 'number' && !isNaN(input);
}

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
  return frame.frame.name + (frame.frame.image || '');
}

function defaultFrameSort(a: FlamegraphFrame, b: FlamegraphFrame): number {
  return defaultFrameSortKey(a) > defaultFrameSortKey(b) ? 1 : -1;
}

export function makeColorBucketTheme(
  lch: LCH,
  spectrum = 360,
  offset = 0
): (t: number) => ColorChannels {
  return t => {
    const x = triangle(30.0 * t);
    const tx = 0.9 * t;
    const H = spectrum < 360 ? offset + spectrum * tx : spectrum * tx;
    const C = lch.C_0 + lch.C_d * x;
    const L = lch.L_0 - lch.L_d * x;
    return fromLumaChromaHue(L, C, H);
  };
}

export function makeColorMapBySymbolName(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();
  const colorCache: Map<string, ColorChannels> = new Map();

  const sortedFrames: FlamegraphFrame[] = [...frames].sort(defaultFrameSort);
  const uniqueCount = uniqueCountBy(sortedFrames, t => t.frame.name + t.frame.image);

  for (let i = 0; i < sortedFrames.length; i++) {
    const frame = sortedFrames[i];

    const key = frame.frame.name + frame.frame.image;

    if (!colorCache.has(key)) {
      const color = colorBucket(Math.floor((255 * i) / uniqueCount) / 256);
      colorCache.set(key, color);
    }

    colors.set(frame.key, colorCache.get(key)!);
  }

  return colors;
}

export function makeColorMapByRecursion(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  const colors = new Map<FlamegraphFrame['frame']['key'], ColorChannels>();
  const colorCache = new Map<FlamegraphFrame['frame']['key'], ColorChannels>();

  const sortedFrames = [...frames].sort(defaultFrameSort);
  const uniqueCount = uniqueCountBy(sortedFrames, t => t.node.isRecursive());

  for (let i = 0; i < sortedFrames.length; i++) {
    if (!sortedFrames[i].node.isRecursive()) {
      continue;
    }
    const frame = sortedFrames[i]!;
    const key = frame.frame.name + frame.frame.image;

    if (!colorCache.has(key)) {
      const color = colorBucket(Math.floor((255 * i) / uniqueCount) / 256);
      colorCache.set(key, color);
    }

    colors.set(frame.key, colorCache.get(key)!);
  }

  return colors;
}

export function makeColorMapByLibrary(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();
  const colorCache: Map<string, ColorChannels> = new Map();

  const sortedFrames: FlamegraphFrame[] = [...frames].sort((a, b) => {
    return (a.frame.image ?? '').localeCompare(b.frame.image ?? '');
  });

  const uniqueCount = uniqueCountBy(sortedFrames, t =>
    t.frame.image ? t.frame.image : false
  );

  for (let i = 0; i < sortedFrames.length; i++) {
    const frame = sortedFrames[i];

    if (!frame.frame.image) {
      continue;
    }

    const color =
      colorCache.get(frame.frame.image) ||
      colorBucket(Math.floor((255 * i) / uniqueCount) / 256);

    colorCache.set(frame.frame.image, color);
    colors.set(frame.key, color);
  }

  return colors;
}

export function makeColorMapBySystemFrame(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();
  const colorCache: Map<string, ColorChannels> = new Map();

  const sortedFrames: FlamegraphFrame[] = [...frames].sort((a, b) => {
    return (a.frame.name + a.frame.image).localeCompare(b.frame.name + b.frame.image);
  });

  const uniqueCount = uniqueCountBy(sortedFrames, t => t.frame.name + t.frame.image);
  for (let i = 0; i < sortedFrames.length; i++) {
    if (sortedFrames[i].frame.is_application) {
      continue;
    }

    const key = sortedFrames[i].frame.name + sortedFrames[i].frame.image;
    if (!colorCache.has(key)) {
      const color = colorBucket(Math.floor((255 * i) / uniqueCount) / 256);
      colorCache.set(key, color);
    }

    colors.set(sortedFrames[i].key, colorCache.get(key)!);
  }

  return colors;
}

export function makeColorMapBySystemVsApplicationFrame(
  frames: ReadonlyArray<FlamegraphFrame>,
  _colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
  theme: FlamegraphTheme
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();
  const colorCache: Map<string, ColorChannels> = new Map();

  const sortedFrames: FlamegraphFrame[] = [...frames].sort((a, b) => {
    return (a.frame.name + a.frame.image).localeCompare(b.frame.name + b.frame.image);
  });

  for (let i = 0; i < sortedFrames.length; i++) {
    const key = sortedFrames[i].frame.name + sortedFrames[i].frame.image;

    if (sortedFrames[i].frame.is_application) {
      colorCache.set(key, theme.COLORS.FRAME_APPLICATION_COLOR);
    } else {
      colorCache.set(key, theme.COLORS.FRAME_SYSTEM_COLOR);
    }

    colors.set(sortedFrames[i].key, colorCache.get(key)!);
  }

  return colors;
}

export function makeColorMapByApplicationFrame(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();
  const colorCache: Map<string, ColorChannels> = new Map();

  const sortedFrames: FlamegraphFrame[] = [...frames].sort((a, b) => {
    return (a.frame.name + a.frame.image).localeCompare(b.frame.name + b.frame.image);
  });

  const uniqueCount = uniqueCountBy(sortedFrames, t => t.frame.name + t.frame.image);
  for (let i = 0; i < sortedFrames.length; i++) {
    if (!sortedFrames[i].frame.is_application) {
      continue;
    }

    const key = sortedFrames[i].frame.name + sortedFrames[i].frame.image;
    if (!colorCache.has(key)) {
      const color = colorBucket(Math.floor((255 * i) / uniqueCount) / 256);
      colorCache.set(key, color);
    }

    colors.set(sortedFrames[i].key, colorCache.get(key)!);
  }

  return colors;
}

export function makeColorMapByFrequency(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  let max = 0;

  const countMap = new Map<FlamegraphFrame['frame']['key'], number>();
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!; // iterating over non empty array
    const key = frame.frame.name + frame.frame.image;

    if (!countMap.has(key)) {
      countMap.set(key, 0);
    }

    const previousCount = countMap.get(key)!;

    countMap.set(key, previousCount + 1);
    max = Math.max(max, previousCount + 1);
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!; // iterating over non empty array
    const key = frame.frame.name + frame.frame.image;
    const count = countMap.get(key)!;
    const [r, g, b] = colorBucket(0.7);
    const color: ColorChannels = [r, g, b, Math.max(count / max, 0.1)];

    colors.set(frame.key, color);
  }

  return colors;
}

export function makeSpansColorMapByOpAndDescription(
  spans: ReadonlyArray<SpanChart['spans'][0]>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<SpanChartNode['node']['span']['span_id'], ColorChannels> {
  const colors = new Map<SpanChartNode['node']['span']['span_id'], ColorChannels>();
  const uniqueSpans = uniqueBy(spans, s => s.node.span.op ?? '');

  for (let i = 0; i < uniqueSpans.length; i++) {
    const key = uniqueSpans[i].node.span.op ?? '';
    if (key === 'missing instrumentation') {
      continue;
    }
    colors.set(key, colorBucket(i / uniqueSpans.length));
  }

  for (let i = 0; i < spans.length; i++) {
    colors.set(spans[i].node.span.span_id, colors.get(spans[i].node.span.op ?? '')!);
  }

  return colors;
}
