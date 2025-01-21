import {useCallback, useRef} from 'react';

import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import theme from 'sentry/utils/theme';

const CACHE_SIZE = 20; // number of palettes to cache

export function createChartPalette(seriesNames: string[]): Record<string, string> {
  const uniqueSeriesNames = Array.from(new Set(seriesNames));
  // We do length - 2 to be aligned with the colors in other parts of the app (copy-pasta)
  // We use Math.max to avoid numbers < -1 as then `getColorPalette` returns undefined (not typesafe because of array access and casting)
  const chartColors =
    theme.charts.getColorPalette(Math.max(uniqueSeriesNames.length - 2, -1)) ??
    CHART_PALETTE[CHART_PALETTE.length - 1] ??
    [];

  return uniqueSeriesNames.reduce(
    (palette, seriesName, i) => {
      palette[seriesName] = chartColors[i % chartColors.length]!;
      return palette;
    },
    {} as Record<string, string>
  );
}

/**
 * **NOTE: Not yet optimized for performance, it should only be used for the metrics page with a limited amount of series**
 *
 * Runtime complexity is O(n * m) where n is the number of palettes in the cache and m is the number of seriesNames
 *
 * Creates chart palettes for the given seriesNames and caches them in a LRU cache
 * If a palette for the given seriesNames already exists in the cache, it will be returned
 * @param cache object that will contain the cached palettes
 * @param seriesNames names of the series for which to get the palette for
 * @returns an object mapping seriesNames to colors
 */
export function getCachedChartPalette(
  cache: Readonly<Record<string, string>>[],
  seriesNames: string[]
): Readonly<Record<string, string>> {
  // Check if we already have a palette that includes all of the given seriesNames
  // We search in reverse to get the most recent palettes first
  let cacheIndex = -1;
  for (let i = cache.length - 1; i >= 0; i--) {
    const palette = cache[i]!;
    if (seriesNames.every(seriesName => seriesName in palette)) {
      cacheIndex = i;
      break;
    }
  }

  if (cacheIndex > -1) {
    const cachedPalette = cache[cacheIndex]!;

    if (cacheIndex !== cache.length - 1) {
      // Move the cached palette to the end of the cache, so it is the most recent one
      cache.splice(cacheIndex, 1);
      cache.push(cachedPalette);
    }

    return cachedPalette;
  }

  // If we do not have a palette for the given seriesNames, create one
  const newPalette = createChartPalette(seriesNames);

  // Single series palettes will always be the same, so we do not need to cache them
  if (seriesNames.length > 1) {
    cache.push(newPalette);
  }

  // Don't cache more than CACHE_SIZE palettes, so we do not create a memory leak
  if (cache.length > CACHE_SIZE) {
    const overflow = cache.length - CACHE_SIZE;
    cache.splice(0, overflow);
  }

  return newPalette;
}

/**
 * **NOTE: Not yet optimized for performance, it should only be used for the metrics page with a limited amount of series**
 */
export const useGetCachedChartPalette = () => {
  const cacheRef = useRef<Readonly<Record<string, string>>[]>([]);
  return useCallback((seriesNames: string[]) => {
    // copy the cache to avoid mutating it
    return {...getCachedChartPalette(cacheRef.current, seriesNames)};
  }, []);
};
