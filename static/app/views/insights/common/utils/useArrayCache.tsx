import {useMemo, useRef} from 'react';

type Cache<T> = {
  items: T[];
};

type SortFn<T> = (items: T[]) => T[];
type MergeFn<T> = (items: T[]) => T[];

interface Props<T> {
  items: T[];
  limit?: number;
  mergeFn?: MergeFn<T>;
  sortFn?: SortFn<T>;
}

/**
 * An array cache hook. Every render of this hook appends the contents of
 *  the `items` prop to the current cache. Cache never expires, but respects
 *  a limit if it's set. Useful for autocomplete dropdowns, etc.
 *
 * e.g.,
 * ```jsx
 * const greetingsData = useGreetingsFromServer({query: userInput});
 * const greetings = useArrayCache({ items: greetingsData });
 * ```
 *
 * `sortFn` is used to determine the order of returned items.
 * `mergeFn` is used to deduplicate items.
 *
 * Every time the `useArrayCache` hook is called with new items it adds
 * them to the cache, and returns all known items.
 */
export function useArrayCache<T>(props: Props<T>): T[] {
  const {items: incomingItems, sortFn, mergeFn, limit = -1} = props;

  // The cache is a reference. This makes it possible to update the cache without causing a re-render, which avoids an infinite render loop.
  const cache = useRef<Cache<T>>({
    items: [],
  });

  const items = useMemo(() => {
    let newItems = [...cache.current.items, ...incomingItems];

    if (sortFn) {
      // Sort before merge, in case the merge function wants to take advantage
      // of a sorted array.
      newItems = sortFn(newItems);
    }

    if (mergeFn) {
      newItems = mergeFn(newItems);
    }

    if (limit > 0) {
      newItems = newItems.slice(0, limit);
    }

    cache.current.items = newItems;

    return cache.current.items;
  }, [incomingItems, sortFn, mergeFn, limit]);

  return items;
}

export function setMerge<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
