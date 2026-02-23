import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';
import {useVirtualizer} from '@tanstack/react-virtual';

type Opts = {
  defaultColumnWidth: number;
  dynamicColumnIndex: number;
  minDynamicColumnWidth: number;
  overscan: number;
  rowCount: number;
  rowHeight: number;
  staticColumnWidths: number[];
};

function useVirtualizedGrid({
  defaultColumnWidth,
  dynamicColumnIndex,
  minDynamicColumnWidth,
  overscan,
  rowCount,
  rowHeight,
  staticColumnWidths,
}: Opts) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [wrapperWidth, setWrapperWidth] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const updateMeasurements = useCallback(() => {
    const width = wrapperRef.current?.getBoundingClientRect().width ?? 0;
    const verticalScrollbarWidth =
      (scrollContainerRef.current?.offsetWidth ?? 0) -
      (scrollContainerRef.current?.clientWidth ?? 0);
    const nextScrollbarWidth = Math.max(verticalScrollbarWidth, 0);

    setWrapperWidth(prev => (prev === width ? prev : width));
    setScrollbarWidth(prev => (prev === nextScrollbarWidth ? prev : nextScrollbarWidth));
  }, []);

  useResizeObserver({ref: wrapperRef, onResize: updateMeasurements});
  useResizeObserver({ref: scrollContainerRef, onResize: updateMeasurements});

  useEffect(() => {
    updateMeasurements();
    const frame = window.requestAnimationFrame(updateMeasurements);
    return () => window.cancelAnimationFrame(frame);
  }, [updateMeasurements]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollContainerRef.current,
    overscan,
    scrollPaddingStart: 25,
    scrollPaddingEnd: 25,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const columnWidths = useMemo(() => {
    const fullWidth = Math.max(0, wrapperWidth - scrollbarWidth);
    const widths = Array.from(
      {length: staticColumnWidths.length},
      (_, index) => staticColumnWidths[index] ?? defaultColumnWidth
    );
    const staticWidths = widths.reduce(
      (sum, width, index) => (index === dynamicColumnIndex ? sum : sum + width),
      0
    );

    widths[dynamicColumnIndex] = Math.max(
      minDynamicColumnWidth,
      fullWidth - staticWidths
    );
    return widths;
  }, [
    defaultColumnWidth,
    dynamicColumnIndex,
    minDynamicColumnWidth,
    scrollbarWidth,
    staticColumnWidths,
    wrapperWidth,
  ]);

  const gridTemplateColumns = useMemo(
    () => columnWidths.map(width => `${width}px`).join(' '),
    [columnWidths]
  );
  const totalColumnWidth = useMemo(
    () => columnWidths.reduce((sum, width) => sum + width, 0),
    [columnWidths]
  );

  return {
    gridTemplateColumns,
    scrollContainerRef,
    totalColumnWidth,
    virtualRows,
    virtualizer,
    wrapperRef,
  };
}

export default useVirtualizedGrid;
