import {useRef} from 'react';

import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';

type Opts = {
  overscan: number;
  rowCount: number;
  rowHeight: number;
};

export function useVirtualizedGrid({overscan, rowCount, rowHeight}: Opts) {
  const scrollContainerRef = useRef<HTMLTableElement | null>(null);

  const {
    paddingBottom,
    paddingTop,
    virtualItems: virtualRows,
    virtualizer,
  } = useVirtualRows({
    count: rowCount,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollContainerRef.current,
    overscan,
    scrollPaddingStart: 25,
    scrollPaddingEnd: 25,
  });

  return {
    paddingBottom,
    paddingTop,
    scrollContainerRef,
    virtualRows,
    virtualizer,
  };
}
