import type {
  ColorChannels,
  ColorMapFn,
  FlamegraphTheme,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import type {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';

import type {FlamegraphFrame} from '../flamegraphFrame';

function uniqueCountBy<T>(
  arr: ReadonlyArray<T>,
  predicate: (t: T) => string | boolean
): number {
  const visited: Record<string, number> = {};

  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    const key = predicate(arr[i]!);

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
    set.push(item!);
  }

  return set;
}

export function makeColorBufferForNodes(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorMap: Map<any, ColorChannels>,
  fallbackColor: ColorChannels
): number[] {
  const length = frames.length;
  // Length * number of frames * color components
  const colorBuffer: number[] = new Array(length * 4 * 6);

  for (let index = 0; index < length; index++) {
    const frame = frames[index];

    if (!frame) {
      continue;
    }

    const c = colorMap.get(frame.node);
    const colorWithAlpha = c && c.length === 3 ? c.concat(1) : c ? c : fallbackColor;

    for (let i = 0; i < 6; i++) {
      const offset = index * 6 * 4 + i * 4;
      colorBuffer[offset] = colorWithAlpha[0]!;
      colorBuffer[offset + 1] = colorWithAlpha[1]!;
      colorBuffer[offset + 2] = colorWithAlpha[2]!;
      colorBuffer[offset + 3] = colorWithAlpha[3]!;
    }
  }

  return colorBuffer;
}

export function makeColorBuffer(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorMap: Map<any, ColorChannels>,
  fallbackColor: ColorChannels
): number[] {
  const length = frames.length;
  // Length * number of frames * color components
  const colorBuffer: number[] = new Array(length * 4 * 6);

  for (let index = 0; index < length; index++) {
    const frame = frames[index];

    if (!frame) {
      continue;
    }

    const c = colorMap.get(frame.key);
    const colorWithAlpha = c && c.length === 3 ? c.concat(1) : c ? c : fallbackColor;

    for (let i = 0; i < 6; i++) {
      const offset = index * 6 * 4 + i * 4;
      colorBuffer[offset] = colorWithAlpha[0]!;
      colorBuffer[offset + 1] = colorWithAlpha[1]!;
      colorBuffer[offset + 2] = colorWithAlpha[2]!;
      colorBuffer[offset + 3] = colorWithAlpha[3]!;
    }
  }

  return colorBuffer;
}

export const makeStackToColor = (
  fallbackColor: [number, number, number, number]
): FlamegraphTheme['COLORS']['STACK_TO_COLOR'] => {
  return (
    frames: ReadonlyArray<FlamegraphFrame>,
    generateColorMap: ColorMapFn,
    colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET'],
    theme: FlamegraphTheme
  ) => {
    const colorMap = generateColorMap(frames, colorBucket, theme);
    const colorBuffer = makeColorBuffer(frames, colorMap, fallbackColor);
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

function frameLibraryKey(frame: FlamegraphFrame): string {
  return frame.frame.package ?? frame.frame.module ?? '';
}

export function defaultFrameKey(frame: FlamegraphFrame): string {
  return `${frame.frame.name}:${frame.frame.package}:${frame.frame.module}`;
}

function defaultFrameSort(a: FlamegraphFrame, b: FlamegraphFrame): number {
  return defaultFrameKey(a) > defaultFrameKey(b) ? 1 : -1;
}

export function makeColorMapBySymbolName(
  frames: ReadonlyArray<FlamegraphFrame>,
  colorBucket: FlamegraphTheme['COLORS']['COLOR_BUCKET']
): Map<FlamegraphFrame['frame']['key'], ColorChannels> {
  const colors = new Map<FlamegraphFrame['key'], ColorChannels>();
  const colorCache: Map<string, ColorChannels> = new Map();

  const sortedFrames: FlamegraphFrame[] = [...frames].sort(defaultFrameSort);
  const uniqueCount = uniqueCountBy(sortedFrames, t => defaultFrameKey(t));

  for (let i = 0; i < sortedFrames.length; i++) {
    const frame = sortedFrames[i]!;

    const key = defaultFrameKey(frame);

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
  const uniqueCount = uniqueCountBy(sortedFrames, t => !!t.node.recursive);

  for (let i = 0; i < sortedFrames.length; i++) {
    if (!sortedFrames[i]!.node.recursive) {
      continue;
    }
    const frame = sortedFrames[i]!;
    const key = defaultFrameKey(frame);

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
    return frameLibraryKey(a).localeCompare(frameLibraryKey(b));
  });

  const uniqueCount = uniqueCountBy(sortedFrames, t => frameLibraryKey(t));

  for (let i = 0; i < sortedFrames.length; i++) {
    const frame = sortedFrames[i]!;

    const key = frameLibraryKey(frame);

    if (!key) {
      continue;
    }

    const color =
      colorCache.get(key) || colorBucket(Math.floor((255 * i) / uniqueCount) / 256);

    colorCache.set(key, color);
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
    return defaultFrameKey(a).localeCompare(defaultFrameKey(b));
  });

  const uniqueCount = uniqueCountBy(sortedFrames, t => defaultFrameKey(t));
  for (let i = 0; i < sortedFrames.length; i++) {
    if (sortedFrames[i]!.frame.is_application) {
      continue;
    }

    const key = defaultFrameKey(sortedFrames[i]!);
    if (!colorCache.has(key)) {
      const color = colorBucket(Math.floor((255 * i) / uniqueCount) / 256);
      colorCache.set(key, color);
    }

    colors.set(sortedFrames[i]!.key, colorCache.get(key)!);
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
    return defaultFrameKey(a).localeCompare(defaultFrameKey(b));
  });

  for (let i = 0; i < sortedFrames.length; i++) {
    const key = defaultFrameKey(sortedFrames[i]!);

    if (sortedFrames[i]!.frame.is_application) {
      colorCache.set(key, theme.COLORS.FRAME_APPLICATION_COLOR);
    } else {
      colorCache.set(key, theme.COLORS.FRAME_SYSTEM_COLOR);
    }

    colors.set(sortedFrames[i]!.key, colorCache.get(key)!);
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
    return defaultFrameKey(a).localeCompare(defaultFrameKey(b));
  });

  const uniqueCount = uniqueCountBy(sortedFrames, t => defaultFrameKey(t));
  for (let i = 0; i < sortedFrames.length; i++) {
    if (!sortedFrames[i]!.frame.is_application) {
      continue;
    }

    const key = defaultFrameKey(sortedFrames[i]!);
    if (!colorCache.has(key)) {
      const color = colorBucket(Math.floor((255 * i) / uniqueCount) / 256);
      colorCache.set(key, color);
    }

    colors.set(sortedFrames[i]!.key, colorCache.get(key)!);
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
    const key = defaultFrameKey(frame);

    if (!countMap.has(key)) {
      countMap.set(key, 0);
    }

    const previousCount = countMap.get(key)!;

    countMap.set(key, previousCount + 1);
    max = Math.max(max, previousCount + 1);
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!; // iterating over non empty array
    const key = defaultFrameKey(frame);
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
    const key = uniqueSpans[i]!.node.span.op ?? '';
    if (key === 'missing span instrumentation') {
      continue;
    }
    colors.set(key, colorBucket(i / uniqueSpans.length));
  }

  for (let i = 0; i < spans.length; i++) {
    colors.set(spans[i]!.node.span.span_id, colors.get(spans[i]!.node.span.op ?? '')!);
  }

  return colors;
}

// Convert color component from 0-1 to 0-255 range
export function colorComponentsToRGBA(color: number[]): string {
  return `rgba(${Math.floor(color[0]! * 255)}, ${Math.floor(color[1]! * 255)}, ${Math.floor(
    color[2]! * 255
  )}, ${color[3] ?? 1})`;
}
