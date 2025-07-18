import {useMemo} from 'react';
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

export function useDragNDropColumns<T>({
  columns,
  defaultColumn,
  setColumns,
}: UseDragAndDropColumnsProps<T>) {
  const editableColumns = useMemo(() => {
    return columns.map((column, i) => ({id: i + 1, column}));
  }, [columns]);

  function insertColumn(column?: T) {
    setColumns([...columns, column ?? defaultColumn()], 'insert');
  }

  function updateColumnAtIndex(i: number, column: T) {
    setColumns(
      columns.map((col: T, j: number) => (i === j ? column : col)),
      'update'
    );
  }

  function deleteColumnAtIndex(i: number) {
    setColumns(
      columns.length === 1
        ? [defaultColumn()]
        : columns.filter((_: T, j: number) => i !== j),
      'delete'
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const {active, over} = event;

    if (active.id !== over?.id) {
      const oldIndex = editableColumns.findIndex(({id}) => id === active.id);
      const newIndex = editableColumns.findIndex(({id}) => id === over?.id);
      setColumns(arrayMove(columns, oldIndex, newIndex), 'reorder');
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
