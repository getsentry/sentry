import {useEffect, useMemo, useState} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';

export type Column<T> = {
  column: T;
  id: number;
};

interface UseDragAndDropColumnsProps<T> {
  columns: T[];
  defaultColumn: () => T;
  setColumns: (columns: T[], op: 'insert' | 'update' | 'delete' | 'reorder') => void;
}

function extractColumns<T>(editableColumns: Array<Column<T>>) {
  return editableColumns.map(({column}) => column);
}

export function useDragNDropColumns<T>({
  columns,
  defaultColumn,
  setColumns,
}: UseDragAndDropColumnsProps<T>) {
  const mappedColumns = useMemo(() => {
    return columns.map((column, i) => ({id: i + 1, column}));
  }, [columns]);

  const [editableColumns, setEditableColumns] = useState<Array<Column<T>>>(mappedColumns);

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

  function insertColumn(column?: T) {
    setEditableColumns(oldEditableColumns => {
      const newEditableColumns = oldEditableColumns.slice();
      newEditableColumns.push({id: nextId, column: column ?? defaultColumn()});

      setNextId(nextId + 1); // make sure to increment the id for the next time

      setColumns(extractColumns(newEditableColumns), 'insert');

      return newEditableColumns;
    });
  }

  function updateColumnAtIndex(i: number, column: T) {
    setEditableColumns(oldEditableColumns => {
      const newEditableColumns = [...oldEditableColumns];
      newEditableColumns[i]!.column = column;

      setColumns(extractColumns(newEditableColumns), 'update');

      return newEditableColumns;
    });
  }

  function deleteColumnAtIndex(i: number) {
    setEditableColumns(oldEditableColumns => {
      const newEditableColumns =
        oldEditableColumns.length === 1
          ? [{id: 1, column: defaultColumn()}]
          : [...oldEditableColumns.slice(0, i), ...oldEditableColumns.slice(i + 1)];

      setColumns(extractColumns(newEditableColumns), 'delete');

      return newEditableColumns;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const {active, over} = event;

    if (active.id !== over?.id) {
      const oldIndex = editableColumns.findIndex(({id}) => id === active.id);
      const newIndex = editableColumns.findIndex(({id}) => id === over?.id);

      setEditableColumns(oldEditableColumns => {
        const newEditableColumns = arrayMove(oldEditableColumns, oldIndex, newIndex);

        setColumns(extractColumns(newEditableColumns), 'reorder');

        return newEditableColumns;
      });
    }
  }

  return {
    editableColumns,
    insertColumn,
    updateColumnAtIndex,
    deleteColumnAtIndex,
    onDragEnd,
  };
}
