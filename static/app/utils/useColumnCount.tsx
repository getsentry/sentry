import {useCallback, useLayoutEffect, useState, type RefObject} from 'react';
import {useResizeObserver} from '@react-aria/utils';

const COLUMN_BREAKPOINTS = [
  {minWidth: 1950, columnCount: 3},
  {minWidth: 700, columnCount: 2},
  {minWidth: 0, columnCount: 1},
];

/**
 * Determine the column count using available space.
 * Note: This is pretty inefficient since it recalculates on resize, but since Tags/Context is
 * rendered in the page contents, modals, and asides, we can't rely on window breakpoint to
 * accurately describe the available space.
 */
export function useColumnCount(elementRef: RefObject<HTMLElement | null>): number {
  const calculateColumnCount = useCallback(() => {
    const width = elementRef.current?.clientWidth || 0;
    const breakpoint = COLUMN_BREAKPOINTS.find(({minWidth}) => width >= minWidth);
    return breakpoint?.columnCount ?? 1;
  }, [elementRef]);

  const [columnCount, setColumnCount] = useState(calculateColumnCount());

  // If the ref was undefined, calculate the column count again
  useLayoutEffect(() => {
    if (elementRef.current) {
      setColumnCount(calculateColumnCount());
    }
  }, [calculateColumnCount, elementRef]);

  const onResize = useCallback(() => {
    const count = calculateColumnCount();
    setColumnCount(count);
  }, [calculateColumnCount]);

  useResizeObserver({ref: elementRef, onResize});

  return columnCount;
}
