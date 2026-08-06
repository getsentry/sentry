import {useEffect, useRef, useState} from 'react';
import {mergeProps} from '@react-aria/utils';

import {useDragMove} from '@sentry/scraps/dragHandle';

import {GridResizer} from 'sentry/components/tables/gridEditable/styles';

interface ColumnResizerProps {
  columnIndex: number;
  dataRows: number;
  onResizeEnd: () => void;
  onResizeMove: (delta: number) => void;
  onResizeStart: (columnIndex: number, cell: HTMLElement | null) => void;
  minimumColumnWidth?: number;
  onResetColumnSize?: (event: React.MouseEvent, columnIndex: number) => void;
}

/**
 * The resize handle for the table shells that draw their own resizer, as opposed to
 * `Table`, which uses `DragHandle` directly. Reports movement from a pointer drag or
 * the arrow keys to a `useColumnResize`.
 */
export function ColumnResizer({
  columnIndex,
  dataRows,
  minimumColumnWidth,
  onResetColumnSize,
  onResizeEnd,
  onResizeMove,
  onResizeStart,
}: ColumnResizerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [{max, width}, setMeasurements] = useState({max: 0, width: 0});

  const {moveProps} = useDragMove({
    onMove: onResizeMove,
    onMoveEnd: onResizeEnd,
    onMoveStart: () => onResizeStart(columnIndex, ref.current?.closest('th') ?? null),
    orientation: 'horizontal',
  });

  useEffect(() => {
    const cell = ref.current?.closest('th');
    const table = cell?.closest('table');
    if (!cell || !table) {
      return () => {};
    }

    const observer = new ResizeObserver(() =>
      setMeasurements({
        max: Math.max(table.clientWidth, cell.offsetWidth),
        width: cell.offsetWidth,
      })
    );
    observer.observe(cell);
    observer.observe(table);

    return () => observer.disconnect();
  }, []);

  return (
    <GridResizer
      {...mergeProps(moveProps, {
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        onDoubleClick: (event: React.MouseEvent) =>
          onResetColumnSize?.(event, columnIndex),
      })}
      aria-orientation="vertical"
      aria-valuemax={max || undefined}
      aria-valuemin={minimumColumnWidth}
      aria-valuenow={width || undefined}
      dataRows={dataRows}
      ref={ref}
      role="separator"
      tabIndex={0}
    />
  );
}
