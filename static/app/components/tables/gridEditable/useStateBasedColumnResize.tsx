import {useCallback, useState} from 'react';

import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';

interface Props<Col extends GridColumnOrder<unknown>> {
  columns: Col[] | (() => Col[]);
}

export default function useStateBasedColumnResize<Col extends GridColumnOrder<unknown>>({
  columns,
}: Props<Col>) {
  const [columnsWithDynamicWidths, setColumns] = useState(columns);

  const handleResizeColumn = useCallback((columnIndex: number, nextColumn: Col) => {
    setColumns(prev => {
      const next = [...prev];
      next[columnIndex] = nextColumn;
      return next;
    });
  }, []);

  return {
    columns: columnsWithDynamicWidths,
    handleResizeColumn,
  };
}
