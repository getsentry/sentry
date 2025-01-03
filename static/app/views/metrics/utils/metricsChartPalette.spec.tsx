import {getCachedChartPalette} from 'sentry/views/metrics/utils/metricsChartPalette';

describe('getQuerySymbol', () => {
  it('should cache palettes', () => {
    const cache: Record<string, string>[] = [];

    const abcPalette = getCachedChartPalette(cache, ['a', 'b', 'c']);
    expect(cache).toHaveLength(1);

    // As a, b is a subset of a, b, c, we should get the same palette
    const baPalette = getCachedChartPalette(cache, ['b', 'a']);
    expect(cache).toHaveLength(1);
    expect(baPalette).toBe(abcPalette);

    // As a, b, z is not a subset of a, b, c we should get a new palette
    const azbPalette = getCachedChartPalette(cache, ['a', 'z', 'b']);
    expect(cache).toHaveLength(2);
    // a will still be the same as it is the first entry in both arrays
    expect(azbPalette).not.toBe(abcPalette);
  });

  it('should not cache single series palettes', () => {
    const cache: Record<string, string>[] = [];

    const aPalette = getCachedChartPalette(cache, ['a']);
    expect(cache).toHaveLength(0);

    const bPalette = getCachedChartPalette(cache, ['b']);
    expect(cache).toHaveLength(0);

    expect(aPalette).not.toBe(bPalette);
  });

  it('should not cache more than CACHE_SIZE (20) palettes', () => {
    const cache: Record<string, string>[] = Array.from({length: 20}).map(() => ({
      z: '#123123',
    }));

    getCachedChartPalette(cache, ['a', 'b', 'c']);

    expect(cache).toHaveLength(20);

    // Ensure it removes more than 1 cache entry
    const cache2: Record<string, string>[] = Array.from({length: 100}).map(() => ({
      z: '#123123',
    }));

    getCachedChartPalette(cache2, ['a', 'b', 'c']);

    expect(cache2).toHaveLength(20);
  });
});
