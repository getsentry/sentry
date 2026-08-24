import {useCallback, useLayoutEffect, useMemo, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

interface ColumnAncestors {
  cell: HTMLTableCellElement | null;
  table: HTMLTableElement | null;
}

const NO_ANCESTORS: ColumnAncestors = {cell: null, table: null};

function setProperty(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}

function measureColumn(
  element: HTMLElement,
  cell: HTMLTableCellElement,
  table: HTMLTableElement
) {
  setProperty(element, '--column-resizer-height', `${table.offsetHeight}px`);
  setProperty(element, '--drag-separator-target-length', `${cell.offsetHeight}px`);

  return {max: Math.max(table.clientWidth, cell.offsetWidth), width: cell.offsetWidth};
}

/**
 * Measures the column a resize handle belongs to, for the values the handle
 * announces, the height it should span as `--column-resizer-height`, and the
 * header row height its pointer target is capped to as
 * `--drag-separator-target-length`.
 */
export function useObservedColumnSize(elementRef: React.RefObject<HTMLElement | null>) {
  const [measurements, setMeasurements] = useState({max: 0, width: 0});
  const [{cell, table}, setAncestors] = useState(NO_ANCESTORS);

  const measure = useCallback(
    (element: HTMLElement, target: HTMLTableCellElement, grid: HTMLTableElement) => {
      const next = measureColumn(element, target, grid);

      setMeasurements(current =>
        current.max === next.max && current.width === next.width ? current : next
      );
    },
    []
  );

  useLayoutEffect(() => {
    const element = elementRef.current;
    const foundCell = element?.closest('th') ?? null;
    const foundTable = foundCell?.closest('table') ?? null;

    setAncestors({cell: foundCell, table: foundTable});

    if (element && foundCell && foundTable) {
      measure(element, foundCell, foundTable);
    }
  }, [elementRef, measure]);

  const cellRef = useMemo(() => ({current: cell}), [cell]);
  const tableRef = useMemo(() => ({current: table}), [table]);

  const onResize = useCallback(() => {
    const element = elementRef.current;
    if (!element || !cell || !table) {
      return;
    }

    measure(element, cell, table);
  }, [cell, elementRef, measure, table]);

  useResizeObserver({ref: cellRef, onResize});
  useResizeObserver({ref: tableRef, onResize});

  return {cell, ...measurements};
}
