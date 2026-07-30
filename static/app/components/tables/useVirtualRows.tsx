import {useLayoutEffect} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';

interface UseVirtualRowsOptions {
  count: number;
  estimateSize: (index: number) => number;
  getScrollElement: () => HTMLElement | null;
  estimateKey?: unknown;
  getItemKey?: (index: number) => string | number;
  overscan?: number;
  scrollMargin?: number;
}

export function useVirtualRows({
  count,
  estimateKey,
  estimateSize,
  getItemKey,
  getScrollElement,
  overscan = 5,
  scrollMargin = 0,
}: UseVirtualRowsOptions) {
  const virtualizer = useVirtualizer<HTMLElement, Element>({
    count,
    estimateSize,
    getItemKey,
    getScrollElement,
    overscan,
    scrollMargin,
  });

  // @tanstack/react-virtual does not rebuild its measurements cache when
  // estimateSize starts returning new values. Without this the total size and item
  // offsets keep using the previous estimates, which desyncs the scroll range.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, estimateKey]);

  const virtualItems = virtualizer.getVirtualItems();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];

  return {
    virtualizer,
    virtualItems,
    paddingTop: first ? Math.max(0, first.start - scrollMargin) : 0,
    paddingBottom: last
      ? Math.max(0, virtualizer.getTotalSize() - (last.end - scrollMargin))
      : 0,
  };
}
