import {useMemo, useRef} from 'react';

import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';

type Option = SelectOption<SelectKey>;

type OptionCache = Map<SelectKey, Option>;

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
 */
export function useCompactSelectOptionsCache(options: Option[]): readonly Option[] {
  const cache = useRef<OptionCache>(new Map());

  return useMemo(() => {
    options.forEach(option => {
      cache.current.set(option.value, option);
    });

    return Array.from(cache.current.values()).sort(alphabeticalCompare);
  }, [options]);
}

type OptionComparator = (a: Option, b: Option) => number;

const alphabeticalCompare: OptionComparator = (a, b) => {
  return a.value.toString().localeCompare(b.value.toString());
};
