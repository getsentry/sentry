import {useLayoutEffect} from 'react';
import {useVirtualizer, type Rect} from '@tanstack/react-virtual';

interface UseVirtualRowsOptions {
  count: number;
  estimateSize: (index: number) => number;
  getScrollElement: () => HTMLElement | null;
  estimateKey?: unknown;
  gap?: number;
  getItemKey?: (index: number) => string | number | bigint;
  initialRect?: Rect;
  overscan?: number;
  paddingEnd?: number;
  paddingStart?: number;
  scrollPaddingEnd?: number;
  scrollPaddingStart?: number;
  useAnimationFrameWithResizeObserver?: boolean;
}

export function useVirtualRows({
  count,
  estimateKey,
  estimateSize,
  gap,
  getItemKey,
  getScrollElement,
  initialRect,
  overscan = 5,
  paddingEnd,
  paddingStart,
  scrollPaddingEnd,
  scrollPaddingStart,
  useAnimationFrameWithResizeObserver,
}: UseVirtualRowsOptions) {
  const virtualizer = useVirtualizer<HTMLElement, Element>({
    count,
    estimateSize,
    gap,
    getItemKey,
    getScrollElement,
    initialRect,
    overscan,
    paddingEnd,
    paddingStart,
    scrollPaddingEnd,
    scrollPaddingStart,
    useAnimationFrameWithResizeObserver,
  });

  // @tanstack/react-virtual does not rebuild its measurements cache when
  // estimateSize starts returning new values. Without this the total size and item
  // offsets keep using the previous estimates, which desyncs the scroll range.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, estimateKey]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];

  return {
    virtualizer,
    virtualItems,
    paddingTop: first ? Math.max(0, first.start) : 0,
    paddingBottom: last ? Math.max(0, totalSize - last.end) : 0,
    totalSize,
  };
}
