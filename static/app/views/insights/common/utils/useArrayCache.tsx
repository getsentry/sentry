import {useEffect, useState} from 'react';

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
  const {items, sortFn, mergeFn, limit = -1} = props;

  const [cache, setCache] = useState<Cache<T>>({
    items: [],
  });

  useEffect(() => {
    let newItems = [...cache.items, ...items];

    if (sortFn) {
      // Comparison is done first in case `mergeFn` assumes sorted order
      newItems = sortFn(newItems);
    }

    if (mergeFn) {
      newItems = mergeFn(newItems);
    }

    if (limit > 0) {
      newItems = newItems.slice(0, limit);
    }

    setCache({
      items: newItems,
    });
  }, [items, sortFn, mergeFn, limit]);

  return cache.items;
}

export function setMerge<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
