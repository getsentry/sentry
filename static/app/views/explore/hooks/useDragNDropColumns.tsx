import {useEffect, useMemo, useState} from 'react';
import {arrayMove} from '@dnd-kit/sortable';

export type Column = {
  column: string | undefined;
  id: number;
};

interface UseDragAndDropColumnsProps {
  columns: string[];
}

export function useDragNDropColumns({columns}: UseDragAndDropColumnsProps) {
  const mappedColumns = useMemo(() => {
    return columns.map((column, i) => ({id: i + 1, column}));
  }, [columns]);

  const [editableColumns, setEditableColumns] = useState<Column[]>(mappedColumns);

  useEffect(() => {
    setEditableColumns(prevEditableColumns => {
      // Only update if there's a change between columns and editableColumns
      if (
        JSON.stringify(prevEditableColumns.map(c => c.column)) !== JSON.stringify(columns)
      ) {
        return mappedColumns;
      }
      return prevEditableColumns;
    });
  }, [columns, mappedColumns]);

  const [nextId, setNextId] = useState(editableColumns.length + 1);

  function insertColumn() {
    setEditableColumns(oldEditableColumns => {
      const newEditableColumns = oldEditableColumns.slice();
      newEditableColumns.push({id: nextId, column: undefined});

      setNextId(nextId + 1); // make sure to increment the id for the next time

      return newEditableColumns;
    });
  }

  function updateColumnAtIndex(i: number, column: string) {
    setEditableColumns(oldEditableColumns => {
      const newEditableColumns = [...oldEditableColumns];
      newEditableColumns[i].column = column;
      return newEditableColumns;
    });
  }

  function deleteColumnAtIndex(i: number) {
    setEditableColumns(oldEditableColumns => {
      return [...oldEditableColumns.slice(0, i), ...oldEditableColumns.slice(i + 1)];
    });
  }

  function swapColumnsAtIndex(i: number, j: number) {
    setEditableColumns(oldEditableColumns => {
      return arrayMove(oldEditableColumns, i, j);
    });
  }

  return {
    editableColumns,
    insertColumn,
    updateColumnAtIndex,
    deleteColumnAtIndex,
    swapColumnsAtIndex,
  };
}
