import {useCallback, useMemo, useRef} from 'react';

import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';

type Option = SelectOption<SelectKey>;

type OptionCache<T extends Option> = Map<SelectKey, T>;

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
  const cache = useRef<OptionCache<T>>(new Map());

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  const outgoingOptions = useMemo(() => {
    options.forEach(option => {
      cache.current.set(option.value, option);
    });

    return Array.from(cache.current.values()).sort(alphabeticalCompare);
  }, [options]);

  return {options: outgoingOptions, clear: clearCache};
}

type OptionComparator = (a: Option, b: Option) => number;

const alphabeticalCompare: OptionComparator = (a, b) => {
  return a.value.toString().localeCompare(b.value.toString());
};
