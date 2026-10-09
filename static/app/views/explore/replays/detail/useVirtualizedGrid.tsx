import {useRef} from 'react';

import {SIMPLE_TABLE_HEADER_ROW_HEIGHT} from 'sentry/components/tables/simpleTable';
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
    scrollPaddingStart: SIMPLE_TABLE_HEADER_ROW_HEIGHT.compressed,
    scrollPaddingEnd: SIMPLE_TABLE_HEADER_ROW_HEIGHT.compressed,
  });

  return {
    paddingBottom,
    paddingTop,
    scrollContainerRef,
    virtualRows,
    virtualizer,
  };
}
