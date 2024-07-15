import {useEffect, useRef} from 'react';

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

export function useArrayCache<T>(props: Props<T>): T[] {
  const {items, sortFn, mergeFn, limit = -1} = props;

  const cache = useRef<Cache<T>>({
    items: [],
  });

  useEffect(() => {
    let newItems = [...cache.current.items, ...items];

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

    cache.current.items = newItems;
  }, [items, sortFn, mergeFn, limit]);

  return cache.current.items;
}

export function setMerge<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
