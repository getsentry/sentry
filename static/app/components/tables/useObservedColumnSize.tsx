import {useEffect, useState} from 'react';

/**
 * Measures the column a resize handle belongs to, for the values the handle
 * announces, and sets the height it should span as `--column-resizer-height`.
 */
export function useObservedColumnSize(elementRef: React.RefObject<HTMLElement | null>) {
  const [measurements, setMeasurements] = useState({max: 0, width: 0});

  useEffect(() => {
    const element = elementRef.current;
    const cell = element?.closest('th');
    const table = cell?.closest('table');
    if (!element || !cell || !table) {
      return () => {};
    }

    const observer = new ResizeObserver(() => {
      element.style.setProperty('--column-resizer-height', `${table.offsetHeight}px`);

      setMeasurements({
        max: Math.max(table.clientWidth, cell.offsetWidth),
        width: cell.offsetWidth,
      });
    });
    observer.observe(cell);
    observer.observe(table);

    return () => observer.disconnect();
  }, [elementRef]);

  return measurements;
}
