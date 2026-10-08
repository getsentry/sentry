import {useMemo, useRef} from 'react';

import type {VisibleRange} from 'sentry/components/replays/useJumpButtons';
import {SIMPLE_TABLE_HEADER_ROW_HEIGHT} from 'sentry/components/tables/simpleTable';
import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';
import {getVisibleRangeFromVirtualRows} from 'sentry/views/explore/replays/detail/virtualizedTableUtils';

const ESTIMATED_ROW_HEIGHT = 45;
const OVERSCAN = 20;

export function useVirtualizedTable({rowCount}: {rowCount: number}) {
  const tableRef = useRef<HTMLTableElement>(null);

  const {
    paddingBottom,
    paddingTop,
    virtualItems: virtualRows,
    virtualizer,
  } = useVirtualRows({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    getScrollElement: () => tableRef.current,
    overscan: OVERSCAN,
    scrollPaddingEnd: SIMPLE_TABLE_HEADER_ROW_HEIGHT,
  });

  const visibleRange = useMemo<VisibleRange>(
    () =>
      getVisibleRangeFromVirtualRows({
        indexOffset: 1,
        scrollOffset: virtualizer.scrollOffset ?? 0,
        viewportHeight: Math.max(
          0,
          (virtualizer.scrollRect?.height ?? 0) - SIMPLE_TABLE_HEADER_ROW_HEIGHT
        ),
        virtualRows,
      }),
    [virtualRows, virtualizer.scrollOffset, virtualizer.scrollRect?.height]
  );

  return {
    paddingBottom,
    paddingTop,
    tableRef,
    virtualRows,
    virtualizer,
    visibleRange,
  };
}
