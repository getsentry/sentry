import {
  makeColorBucketTheme,
  makeColorMap,
  makeColorMapByImage,
  makeColorMapByRecursion,
} from 'sentry/utils/profiling/colors/utils';
import {LCH_LIGHT} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {Frame} from 'sentry/utils/profiling/frame';

const f = (name: string, file?: string, image?: string) =>
  new Frame({key: name + (file ? file : ''), name, file, image});

const dominantColor = (
  c: [number, number, number] | [number, number, number, number] | undefined
): string => {
  if (!c) throw new Error('Color not found');

  const index = c.indexOf(Math.max(...c));
  return index === 0 ? 'red' : index === 1 ? 'green' : 'blue';
};

describe('makeColorMap', () => {
  it('default colors by frame name', () => {
    // Reverse order to ensure we actually sort
    const frames = [f('c'), f('b'), f('a')];

    const map = makeColorMap(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(dominantColor(map.get('a'))).toBe('red');
    expect(dominantColor(map.get('b'))).toBe('green');
    expect(dominantColor(map.get('c'))).toBe('blue');
  });

  it('colors by custom sort', () => {
    // Reverse order to ensure we actually sort
    const frames = [f('c'), f('b'), f('a')];

    const map = makeColorMap(frames, makeColorBucketTheme(LCH_LIGHT), (a, b) =>
      b.name > a.name ? 1 : -1
    );

    expect(dominantColor(map.get('a'))).toBe('blue');
    expect(dominantColor(map.get('b'))).toBe('green');
    expect(dominantColor(map.get('c'))).toBe('red');
  });

  it('colors by image', () => {
    // Reverse order to ensure we actually sort
    const frames = [
      f('c', undefined, 'c'),
      f('b', undefined, 'b'),
      f('a', undefined, 'a'),
    ];

    const map = makeColorMapByImage(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(dominantColor(map.get('a'))).toBe('red');
    expect(dominantColor(map.get('b'))).toBe('green');
    expect(dominantColor(map.get('c'))).toBe('blue');
  });

  it('colors by recursive frames', () => {
    // Reverse order to ensure we actually sort
    const frames = [f('aaa'), f('aaa'), f('aaa'), f('c')];

    frames[1].recursive = frames[0];
    frames[2].recursive = frames[1];

    const map = makeColorMapByRecursion(frames, makeColorBucketTheme(LCH_LIGHT));

    expect(dominantColor(map.get('aaa'))).toBe('red');
    expect(map.get('c')).toBeUndefined();
  });
});
