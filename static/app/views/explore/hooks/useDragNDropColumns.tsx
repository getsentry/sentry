import {useRef} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';

import {uniqueId} from 'sentry/utils/guid';

export type Column<T> = {
  column: T;
  id: number;
  uniqueId: string;
};

interface UseDragAndDropColumnsProps<T> {
  columns: T[];
  setColumns: (columns: T[], op: 'insert' | 'update' | 'delete' | 'reorder') => void;
}

export function useDragNDropColumns<T>({
  columns,
  setColumns,
}: UseDragAndDropColumnsProps<T>) {
  const uniqueIdsRef = useRef<string[]>([]);

  uniqueIdsRef.current.length = Math.min(uniqueIdsRef.current.length, columns.length);
  while (uniqueIdsRef.current.length < columns.length) {
    uniqueIdsRef.current.push(uniqueId());
  }

  const editableColumns = columns.map((column, i) => ({
    id: i + 1,
    uniqueId: uniqueIdsRef.current[i]!,
    column,
  }));

  function insertColumn(column: T) {
    uniqueIdsRef.current = [...uniqueIdsRef.current, uniqueId()];
    setColumns([...columns, column], 'insert');
  }

  function updateColumnAtIndex(i: number, column: T) {
    setColumns(
      columns.map((col: T, j: number) => (i === j ? column : col)),
      'update'
    );
  }

  function deleteColumnAtIndex(i: number) {
    uniqueIdsRef.current = uniqueIdsRef.current.filter((_, j) => i !== j);
    setColumns(
      columns.filter((_: T, j: number) => i !== j),
      'delete'
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const {active, over} = event;

    if (active.id !== over?.id) {
      const oldIndex = editableColumns.findIndex(({id}) => id === active.id);
      const newIndex = editableColumns.findIndex(({id}) => id === over?.id);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }
      uniqueIdsRef.current = arrayMove(uniqueIdsRef.current, oldIndex, newIndex);
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
