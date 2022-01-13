import {
  makeColorBucketTheme,
  makeColorMap,
  makeColorMapByImage,
  makeColorMapByRecursion,
  makeStackToColor,
} from 'sentry/utils/profiling/colors/utils';
import {LCH_LIGHT} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {Frame} from 'sentry/utils/profiling/frame';

const f = (name: string, file?: string, image?: string) =>
  new Frame({key: name + (file ? file : ''), name, file, image});

const getDominantColor = (
  c: [number, number, number] | [number, number, number, number] | undefined
): string => {
  if (!c) {
    throw new Error('Color not found');
  }

  const index = c.indexOf(Math.max(...c.slice(0, 3)));
  return index === 0 ? 'red' : index === 1 ? 'green' : 'blue';
};

describe('makeStackToColor', () => {
  it('uses fallback color in case frames is not found', () => {
    // Bright red color fallback
    const fallback = [1, 0, 0, 1] as [number, number, number, number];

    const makeFn = makeStackToColor(fallback);

    const frames = [f('a')];

    const {colorBuffer} = makeFn(
      frames,
      () => new Map(),
      makeColorBucketTheme(LCH_LIGHT)
    );
    expect(colorBuffer.slice(0, 4)).toEqual(fallback);
    expect(colorBuffer).toHaveLength(24);
  });

  it('uses the color encoding', () => {
    // Bright red color fallback
    const fallback = [1, 0, 0, 1] as [number, number, number, number];

    const makeFn = makeStackToColor(fallback);

    const frames = [f('a')];

    const {colorBuffer} = makeFn(frames, makeColorMap, makeColorBucketTheme(LCH_LIGHT));
    expect(colorBuffer.slice(0, 4)).toEqual([
      0.9750000000000001, 0.7250000000000001, 0.7250000000000001, 1,
    ]);
    expect(
      getDominantColor(colorBuffer.slice(0, 4) as [number, number, number, number])
    ).toBe('red');
    expect(colorBuffer).toHaveLength(24);
  });

  it('sets alpha component if none is set by the colorMap fn', () => {
    // Bright red color fallback
    const fallback = [1, 0, 0, 1] as [number, number, number, number];

    const makeFn = makeStackToColor(fallback);
    const frames = [f('a')];

    const {colorBuffer} = makeFn(
      frames,
      () => {
        const m = new Map();
        // Only set rgb
        m.set('a', [1, 0, 0]);
        return m;
      },
      makeColorBucketTheme(LCH_LIGHT)
    );
    expect(colorBuffer.slice(0, 4)).toEqual([1, 0, 0, 1]);
    expect(colorBuffer).toHaveLength(24);
  });
});

describe('makeColorMap', () => {
  it('default colors by frame name', () => {
    // Reverse order to ensure we actually sort
    const frames = [f('c'), f('b'), f('a')];

    const map = makeColorMap(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(getDominantColor(map.get('a'))).toBe('red');
    expect(getDominantColor(map.get('b'))).toBe('green');
    expect(getDominantColor(map.get('c'))).toBe('blue');
  });

  it('colors by custom sort', () => {
    // Reverse order to ensure we actually sort
    const frames = [f('c'), f('b'), f('a')];

    const map = makeColorMap(frames, makeColorBucketTheme(LCH_LIGHT), (a, b) =>
      b.name > a.name ? 1 : -1
    );

    expect(getDominantColor(map.get('a'))).toBe('blue');
    expect(getDominantColor(map.get('b'))).toBe('green');
    expect(getDominantColor(map.get('c'))).toBe('red');
  });

  it('colors by image', () => {
    // Reverse order to ensure we actually sort
    const frames = [
      f('c', undefined, 'c'),
      f('b', undefined, 'b'),
      f('a', undefined, 'a'),
    ];

    const map = makeColorMapByImage(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(getDominantColor(map.get('a'))).toBe('red');
    expect(getDominantColor(map.get('b'))).toBe('green');
    expect(getDominantColor(map.get('c'))).toBe('blue');
  });

  it('colors by recursive frames', () => {
    // Reverse order to ensure we actually sort
    const frames = [f('aaa'), f('aaa'), f('aaa'), f('c')];

    frames[1].recursive = frames[0];
    frames[2].recursive = frames[1];

    const map = makeColorMapByRecursion(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(getDominantColor(map.get('aaa'))).toBe('red');
    expect(map.get('c')).toBeUndefined();
  });
});
