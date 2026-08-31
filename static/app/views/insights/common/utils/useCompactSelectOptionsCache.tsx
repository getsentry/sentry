import {useCallback, useMemo, useRef} from 'react';

import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';

type Option = SelectOption<SelectKey>;

const DEFAULT_CACHE_KEY = 'cacheKey';

/**
 * Cache designed for the `option` prop of a `CompactSelect`. Accepts
 * an array of `Option` objects. Returns a list of all `Option` objects
 * it has been passed since instantiation.
 *
 * Useful when passing a `CompactSelect` `options` that come from a server
 *  response. With a cache, `CompactSelect` can:
 *
 * 1. Display an options dropdown even when new results are loading
 * 2. Shows options from 3 searches ago if the user changes their mind
 *
 * NOTE: The `clear` callback does not trigger a re-render. The cleared
 * cache is returned on next call of the hook.
 */
export function useCompactSelectOptionsCache<T extends Option>(
  options: T[]
): {
  clear: () => void;
  options: T[];
} {
  const cacheMap = useRef({[DEFAULT_CACHE_KEY]: new Map()});
  if (!cacheMap.current[DEFAULT_CACHE_KEY]) {
    cacheMap.current[DEFAULT_CACHE_KEY] = new Map();
  }

  const clearCache = useCallback(() => {
    cacheMap.current[DEFAULT_CACHE_KEY]?.clear();
  }, []);

  const outgoingOptions = useMemo(() => {
    options.forEach(option => {
      cacheMap.current[DEFAULT_CACHE_KEY]?.set(option.value, option);
    });

    return Array.from(cacheMap.current[DEFAULT_CACHE_KEY]?.values() ?? []).sort(
      alphabeticalCompare
    );
  }, [options]);

  return {options: outgoingOptions, clear: clearCache};
}

type OptionComparator = (a: Option, b: Option) => number;

const alphabeticalCompare: OptionComparator = (a, b) => {
  return a.value.toString().localeCompare(b.value.toString());
};
