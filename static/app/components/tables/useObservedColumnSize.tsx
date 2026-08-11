import {useCallback, useEffect, useMemo, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

interface ColumnAncestors {
  cell: HTMLTableCellElement | null;
  table: HTMLTableElement | null;
}

const NO_ANCESTORS: ColumnAncestors = {cell: null, table: null};

/**
 * Measures the column a resize handle belongs to, for the values the handle
 * announces, and sets the height it should span as `--column-resizer-height`.
 */
export function useObservedColumnSize(elementRef: React.RefObject<HTMLElement | null>) {
  const [measurements, setMeasurements] = useState({max: 0, width: 0});
  const [{cell, table}, setAncestors] = useState(NO_ANCESTORS);

  useEffect(() => {
    const found = elementRef.current?.closest('th') ?? null;

    setAncestors({cell: found, table: found?.closest('table') ?? null});
  }, [elementRef]);

  const cellRef = useMemo(() => ({current: cell}), [cell]);
  const tableRef = useMemo(() => ({current: table}), [table]);

  const onResize = useCallback(() => {
    const element = elementRef.current;
    if (!element || !cell || !table) {
      return;
    }

    element.style.setProperty('--column-resizer-height', `${table.offsetHeight}px`);

    setMeasurements({
      max: Math.max(table.clientWidth, cell.offsetWidth),
      width: cell.offsetWidth,
    });
  }, [cell, elementRef, table]);

  useResizeObserver({ref: cellRef, onResize});
  useResizeObserver({ref: tableRef, onResize});

  return {cell, ...measurements};
}
