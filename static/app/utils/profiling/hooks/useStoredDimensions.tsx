import {useMemo} from 'react';
import debounce from 'lodash/debounce';

import {clamp} from 'sentry/utils/profiling/colors/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const factor = Math.pow(10, 4);
function toPrecision(n: number): number {
  return clamp(Math.round(n * factor) / factor, 0, 1);
}
function isStoredDimensions<K extends string>(
  value: unknown
): value is StoredDrawerDimensions<K> {
  if (!value) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  return Object.keys(value).every(
    (k: string) =>
      Array.isArray(value[k]) &&
      value[k].length === 2 &&
      value[k].every(v => {
        return typeof v === 'number' && !isNaN(v) && v > 0 && v < 1;
      })
  );
}

type StoredDrawerDimensions<K extends string> = Partial<Record<K, [number, number]>>;

/**
 * Serializes the dimensions of a resizable drawer into local storage. Basically a K/V store
 * with value specific validation and updating mechanism.
 */
export function useStoredDimensions<K extends string>(
  key: string,
  defaultValue: StoredDrawerDimensions<K>,
  options: {debounce?: number} = {}
): [StoredDrawerDimensions<K> | null, (layout: K, state: [number, number]) => void] {
  const [initialDrawerSize, setDrawerSize] =
    useLocalStorageState<StoredDrawerDimensions<K> | null>(key, rawValue => {
      if (rawValue === null || rawValue === undefined) {
        return defaultValue ?? {};
      }

      if (isStoredDimensions<K>(rawValue)) {
        return rawValue;
      }

      // If all else fails, return empty obj. Since StoredDrawerDimensions is a partial obj,
      // this makes it easier to work with than if we returned null
      return {};
    });

  const debouncedSetDrawerSize = useMemo(() => {
    function callback(currentLayout: K, dimensions: [number, number]) {
      setDrawerSize({
        ...initialDrawerSize,
        [currentLayout]: [toPrecision(dimensions[0]), toPrecision(dimensions[1])],
      });
    }
    return debounce(callback, options.debounce ?? 1000);
  }, [setDrawerSize, options.debounce, initialDrawerSize]);

  return [initialDrawerSize, debouncedSetDrawerSize];
}
