import {useMemo, useRef} from 'react';

type Cache<T> = {
  items: T[];
};

type SortFn<T> = (items: T[]) => T[];

interface Props<T> {
  items: T[];
  limit?: number;
  sortFn?: SortFn<T>;
}

/**
 * An array cache hook. Keeps a list of items in memory. Allows for
 * sorting and merging. Useful for autocomplete dropdowns, and other
 * cases
 *
 * e.g.,
 * ```jsx
 * const greetingsData = useGreetingsFromServer({query: userInput});
 * const greetings = useArrayCache({ items: greetingsData });
 * ```
 *
 * Every time the `useArrayCache` hook is called with new items it adds
 * them to the cache.
 */
export function useArrayCache<T>(props: Props<T>): T[] {
  const {items: incomingItems, sortFn, limit = -1} = props;

  // The cache is a reference. This makes it possible to update the cache without causing a re-render, which avoids an infinite render loop.
  const cache = useRef<Cache<T>>({
    items: [],
  });

  const items = useMemo(() => {
    let newItems = [...cache.current.items, ...incomingItems];

    if (sortFn) {
      newItems = sortFn(newItems);
    }

    if (limit > 0) {
      newItems = newItems.slice(0, limit);
    }

    cache.current.items = newItems;

    return cache.current.items;
  }, [incomingItems, sortFn, limit]);

  return items;
}

export function setMerge<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
