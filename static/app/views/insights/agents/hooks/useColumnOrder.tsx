import {useCallback, useState} from 'react';

import type {
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/tables/gridEditable';

export function useColumnOrder(initialValue: Array<GridColumnOrder<string>>) {
  const [columnOrder, setColumnOrder] = useState(initialValue);

  const handleResizeColumn = useCallback(
    (columnIndex: number, nextColumn: GridColumnHeader<string>) => {
      setColumnOrder(prev => {
        const newColumnOrder = [...prev];
        newColumnOrder[columnIndex] = {
          ...newColumnOrder[columnIndex]!,
          width: nextColumn.width,
        };
        return newColumnOrder;
      });
    },
    []
  );
  return {columnOrder, onResizeColumn: handleResizeColumn};
}
