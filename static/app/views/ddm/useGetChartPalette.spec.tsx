import {getCachedChartPalette} from 'sentry/views/ddm/useGetChartPalette';

describe('getQuerySymbol', () => {
  it('should cache palettes', () => {
    const cache: Record<string, string>[] = [];

    const abcPalette = getCachedChartPalette(cache, ['a', 'b', 'c']);
    expect(cache.length).toBe(1);

    // As a, b is a subset of a, b, c, we should get the same palette
    const baPalette = getCachedChartPalette(cache, ['b', 'a']);
    expect(cache.length).toBe(1);
    expect(baPalette('a')).toBe(abcPalette('a'));
    expect(baPalette('b')).toBe(abcPalette('b'));
    expect(baPalette('random')).toBe(abcPalette('random'));

    // As a, b, z is not a subset of a, b, c we should get a new palette
    const azbPalette = getCachedChartPalette(cache, ['a', 'z', 'b']);
    expect(cache.length).toBe(2);
    // a will still be the same as it is the first entry in both arrays
    expect(azbPalette('a')).toBe(abcPalette('a'));
    expect(azbPalette('z')).not.toBe(abcPalette('z'));
    expect(azbPalette('b')).not.toBe(abcPalette('b'));
  });
});
