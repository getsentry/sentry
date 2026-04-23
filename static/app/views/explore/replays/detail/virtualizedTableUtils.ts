import type {VirtualItem} from '@tanstack/react-virtual';
import classNames from 'classnames';

import type {VisibleRange} from 'sentry/components/replays/useJumpButtons';

interface GetVisibleRangeOpts {
  scrollOffset: number;
  viewportHeight: number;
  virtualRows: VirtualItem[];
  indexOffset?: number;
}

interface TimelineRowClassNameOpts {
  hasHoverTime: boolean;
  hasOccurred: boolean;
  isAsc: boolean;
  isBeforeHover: boolean;
  isByTimestamp: boolean;
  isLastDataRow: boolean;
}

export function getVisibleRangeFromVirtualRows({
  indexOffset = 0,
  scrollOffset,
  viewportHeight,
  virtualRows,
}: GetVisibleRangeOpts): VisibleRange {
  if (virtualRows.length === 0) {
    return {startIndex: 0, stopIndex: 0};
  }

  const viewportEnd = scrollOffset + viewportHeight;
  const visibleItems = virtualRows.filter(item => {
    const itemEnd = item.start + item.size;
    return itemEnd > scrollOffset && item.start < viewportEnd;
  });

  if (visibleItems.length === 0) {
    return {startIndex: 0, stopIndex: 0};
  }

  return {
    startIndex: visibleItems[0]!.index + indexOffset,
    stopIndex: visibleItems[visibleItems.length - 1]!.index + indexOffset,
  };
}

export function getTimelineRowClassName({
  hasHoverTime,
  hasOccurred,
  isAsc,
  isBeforeHover,
  isByTimestamp,
  isLastDataRow,
}: TimelineRowClassNameOpts): string {
  return classNames({
    beforeCurrentTime: isByTimestamp ? (isAsc ? hasOccurred : !hasOccurred) : undefined,
    afterCurrentTime: isByTimestamp ? (isAsc ? !hasOccurred : hasOccurred) : undefined,
    beforeHoverTime:
      isByTimestamp && hasHoverTime
        ? isAsc
          ? isBeforeHover
          : !isBeforeHover
        : undefined,
    afterHoverTime:
      isByTimestamp && hasHoverTime
        ? isAsc
          ? !isBeforeHover
          : isBeforeHover
        : undefined,
    isLastDataRow,
  });
}
