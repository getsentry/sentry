import {useCallback, useRef} from 'react';

import theme from 'sentry/utils/theme';

const CACHE_SIZE = 20; // number of palettes to cache

// We do length - 2 to be aligned with the colors in other parts of the app (copy-pasta)
// We use Math.max to avoid numbers < -1 as then `getColorPalette` returns undefined (not typesafe because of array access)
export function getChartColors(seriesCount: number) {
  return theme.charts.getColorPalette(Math.max(seriesCount - 2, -1));
}

export function getCachedChartPalette(
  cache: Record<string, string>[],
  seriesNames: string[]
): (seriesName: string) => string {
  // We do length - 2 to be aligned with the colors in other parts of the app (copy-pasta)
  // We use Math.max to avoid numbers < -1 as then `getColorPalette` returns undefined (not typesafe because of array access)
  const defaultColors = getChartColors(seriesNames.length);

  // Check if we already have a palette that includes all of the given seriesNames
  // We reverse the cache to get the most recent palettes first
  const cachedPalette = [...cache]
    .reverse()
    .find(palette => seriesNames.every(seriesName => seriesName in palette));

  if (cachedPalette) {
    // Shift the palette to the end of the cache, so we only remove the oldest palette when hitting the cache limit
    cache.shift();
    cache.push(cachedPalette);
    return seriesName => cachedPalette[seriesName] ?? defaultColors[0];
  }

  // Create a new palette with the default colors ans append at the end of the cache
  const newPalette = seriesNames.reduce(
    (palette, seriesName, i) => {
      palette[seriesName] = defaultColors[i % defaultColors.length];
      return palette;
    },
    {} as Record<string, string>
  );

  // Single series palettes will always be the same, so we do not need to cache them
  if (seriesNames.length > 1) {
    cache.push(newPalette);
  }

  // Don't cache more than CACHE_SIZE palettes, so we do not create a memory leak
  if (cache.length > CACHE_SIZE) {
    cache.shift();
  }

  return seriesName => newPalette[seriesName] ?? defaultColors[0];
}

export const useGetChartPalette = () => {
  const cacheRef = useRef<Record<string, string>[]>([]);
  return useCallback(
    (seriesNames: string[]) => getCachedChartPalette(cacheRef.current, seriesNames),
    []
  );
};
