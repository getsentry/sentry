import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {
  makeColorBucketTheme,
  makeColorMap,
  makeColorMapByImage,
  makeColorMapByRecursion,
  makeStackToColor,
} from 'sentry/utils/profiling/colors/utils';
import {LCH_LIGHT} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Frame} from 'sentry/utils/profiling/frame';

const f = (key: number, name: string, file?: string, image?: string): FlamegraphFrame => {
  return {
    frame: new Frame({key: name + (file ? file : ''), name, file, image}),
    children: [],
    parent: null,
    start: 0,
    end: 0,
    key,
    depth: 0,
    node: new CallTreeNode(
      new Frame({key: name + (file ? file : ''), name, file, image}),
      null
    ),
  };
};

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

    const frames = [f(0, 'a')];

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

    const frames = [f(0, 'a')];

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
    const frames = [f(0, 'a')];

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
    const frames = [f(1, 'c'), f(2, 'b'), f(3, 'a')];

    const map = makeColorMap(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(getDominantColor(map.get(3))).toBe('red');
    expect(getDominantColor(map.get(2))).toBe('green');
    expect(getDominantColor(map.get(1))).toBe('blue');
  });

  it('colors by custom sort', () => {
    // Reverse order to ensure we actually sort
    const frames = [f(1, 'c'), f(2, 'b'), f(3, 'a')];

    const map = makeColorMap(frames, makeColorBucketTheme(LCH_LIGHT), (a, b) =>
      b.frame.name > a.frame.name ? 1 : -1
    );

    expect(getDominantColor(map.get(3))).toBe('blue');
    expect(getDominantColor(map.get(2))).toBe('green');
    expect(getDominantColor(map.get(1))).toBe('red');
  });

  it('colors by image', () => {
    // Reverse order to ensure we actually sort
    const frames = [
      f(1, 'c', undefined, 'c'),
      f(2, 'b', undefined, 'b'),
      f(3, 'a', undefined, 'a'),
    ];

    const map = makeColorMapByImage(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(getDominantColor(map.get(3))).toBe('red');
    expect(getDominantColor(map.get(2))).toBe('green');
    expect(getDominantColor(map.get(1))).toBe('blue');
  });

  it('colors by recursive frames', () => {
    // Reverse order to ensure we actually sort
    const frames = [f(0, 'aaa'), f(1, 'aaa'), f(2, 'aaa'), f(3, 'c')];

    frames[1].node.setRecursive(frames[0].node);
    frames[2].node.setRecursive(frames[1].node);

    const map = makeColorMapByRecursion(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(getDominantColor(map.get(1))).toBe('red');
    expect(map.get(3)).toBeUndefined();
  });
});
