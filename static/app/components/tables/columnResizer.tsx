import {useEffect, useId, useRef} from 'react';
import {mergeProps} from '@react-aria/utils';

import {useDragSeparator} from '@sentry/scraps/dragHandle';

import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {useObservedColumnSize} from 'sentry/components/tables/useObservedColumnSize';

interface ColumnResizerProps {
  columnIndex: number;
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
  minimumColumnWidth,
  onResetColumnSize,
  onResizeEnd,
  onResizeMove,
  onResizeStart,
}: ColumnResizerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {cell, max, width} = useObservedColumnSize(ref);
  const fallbackCellId = useId();

  // A focusable separator is a widget, so it needs a name. The header cell already
  // carries the column's name, and pointing at it rather than repeating it as an
  // `aria-label` keeps the resizer out of that cell's own name-from-content.
  const cellId = cell?.id || fallbackCellId;

  useEffect(() => {
    if (cell && !cell.id) {
      cell.id = fallbackCellId;
    }
  }, [cell, fallbackCellId]);

  const {cursor, separatorProps} = useDragSeparator({
    isSizedFirst: true,
    max: max || undefined,
    min: minimumColumnWidth,
    onMove: onResizeMove,
    onMoveEnd: onResizeEnd,
    onMoveStart: () => onResizeStart(columnIndex, cell),
    orientation: 'horizontal',
    value: width || undefined,
  });

  return (
    <GridResizer
      {...mergeProps(separatorProps, {
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        onDoubleClick: (event: React.MouseEvent) =>
          onResetColumnSize?.(event, columnIndex),
      })}
      aria-labelledby={cellId}
      cursor={cursor}
      ref={ref}
    />
  );
}
