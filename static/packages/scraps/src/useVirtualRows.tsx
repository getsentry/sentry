import {useLayoutEffect} from 'react';
import {
  useVirtualizer,
  type Range,
  type Rect,
  type VirtualizerOptions,
} from '@tanstack/react-virtual';

export interface UseVirtualRowsOptions {
  count: number;
  estimateSize: (index: number) => number;
  getScrollElement: () => HTMLElement | null;
  enabled?: boolean;
  estimateKey?: unknown;
  gap?: number;
  getItemKey?: (index: number) => string | number | bigint;
  initialRect?: Rect;
  observeElementRect?: VirtualizerOptions<HTMLElement, Element>['observeElementRect'];
  overscan?: number;
  paddingEnd?: number;
  paddingStart?: number;
  rangeExtractor?: (range: Range) => number[];
  /**
   * Offset (px) of the first row from the top of the scroll element's content,
   * when other content scrolls above the rows. Row starts include it;
   * `paddingTop`, `paddingBottom` and `totalSize` do not.
   */
  scrollMargin?: number;
  scrollPaddingEnd?: number;
  scrollPaddingStart?: number;
  useAnimationFrameWithResizeObserver?: boolean;
}

export function useVirtualRows({
  estimateKey,
  overscan = 5,
  ...options
}: UseVirtualRowsOptions) {
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer<HTMLElement, Element>({...options, overscan});

  // @tanstack/react-virtual does not rebuild its measurements cache when
  // estimateSize starts returning new values. Without this the total size and item
  // offsets keep using the previous estimates, which desyncs the scroll range.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, estimateKey]);

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const scrollMargin = options.scrollMargin ?? 0;
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];

  return {
    virtualizer,
    virtualItems,
    paddingTop: first ? Math.max(0, first.start - scrollMargin) : 0,
    paddingBottom: last ? Math.max(0, totalSize - (last.end - scrollMargin)) : 0,
    totalSize,
  };
}
