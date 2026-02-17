import {useEffect, useMemo, useState} from 'react';

/**
 * A generic hook that detects which items overflow a container using
 * IntersectionObserver. The caller renders ALL items as children of the
 * container referenced by `containerRef`. The hook observes direct children
 * and maps overflowing DOM child indices back to the `items` array.
 *
 * Returns `{ visibleItems, overflowItems }` as a partition of the input items.
 */
export function useOverflowItems<T>(
  containerRef: React.RefObject<HTMLElement | null>,
  items: T[]
): {
  overflowItems: T[];
  visibleItems: T[];
} {
  const [overflowIndices, setOverflowIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!containerRef.current) {
      return () => {};
    }

    const options: IntersectionObserverInit = {
      root: containerRef.current,
      // Negative right margin reserves space for the "X more" button
      rootMargin: '0px -60px 0px 0px',
      // Use 0.95 rather than 1 because of a bug in Edge (Windows) where the
      // intersection ratio may unexpectedly drop to slightly below 1 (0.999...)
      // on page scroll.
      threshold: 0.95,
    };

    const elementToIndex = new WeakMap<Element, number>();
    const children = Array.from(containerRef.current.children);
    children.forEach((child, index) => elementToIndex.set(child, index));

    const callback: IntersectionObserverCallback = entries => {
      entries.forEach(entry => {
        const index = elementToIndex.get(entry.target);

        if (index === undefined) {
          return;
        }

        if (entry.isIntersecting) {
          setOverflowIndices(prev => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        } else {
          setOverflowIndices(prev => {
            const next = new Set(prev);
            next.add(index);
            return next;
          });
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);

    children.forEach(child => observer.observe(child));

    return () => {
      observer.disconnect();
      setOverflowIndices(new Set());
    };
  }, [containerRef, items.length]);

  const result = useMemo(() => {
    const visibleItems: T[] = [];
    const overflowItems: T[] = [];

    items.forEach((item, index) => {
      if (overflowIndices.has(index)) {
        overflowItems.push(item);
      } else {
        visibleItems.push(item);
      }
    });

    return {visibleItems, overflowItems};
  }, [items, overflowIndices]);

  return result;
}
