import {useLayoutEffect} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';

interface UseVirtualRowsOptions {
  count: number;
  estimateSize: (index: number) => number;
  getScrollElement: () => HTMLElement | null;
  getItemKey?: (index: number) => string | number;
  overscan?: number;
}

/**
 * Windows rows by padding the body rather than positioning them, because an
 * absolutely positioned row is not a grid item and so cannot inherit the
 * table's column tracks via `subgrid`.
 */
export function useVirtualRows({
  count,
  estimateSize,
  getItemKey,
  getScrollElement,
  overscan = 5,
}: UseVirtualRowsOptions) {
  const virtualizer = useVirtualizer<HTMLElement, Element>({
    count,
    estimateSize,
    getItemKey,
    getScrollElement,
    overscan,
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];

  return {
    virtualizer,
    virtualItems,
    paddingTop: first ? Math.max(0, first.start - virtualizer.options.scrollMargin) : 0,
    paddingBottom: last ? Math.max(0, virtualizer.getTotalSize() - last.end) : 0,
  };
}
