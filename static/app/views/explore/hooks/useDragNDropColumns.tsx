import {useEffect, useMemo, useState} from 'react';
import type {DragEndEvent} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';

export type Column = {
  column: string | undefined;
  id: number;
};

interface UseDragAndDropColumnsProps {
  columns: string[];
  setColumns: (columns: string[]) => void;
}

const extractColumns = (editableColumns: Column[]) => {
  return editableColumns.map(({column}) => column ?? '');
};

export function useDragNDropColumns({columns, setColumns}: UseDragAndDropColumnsProps) {
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

      setColumns(extractColumns(newEditableColumns));

      return newEditableColumns;
    });
  }

  function updateColumnAtIndex(i: number, column: string) {
    setEditableColumns(oldEditableColumns => {
      const newEditableColumns = [...oldEditableColumns];
      newEditableColumns[i]!.column = column;

      setColumns(extractColumns(newEditableColumns));

      return newEditableColumns;
    });
  }

  function deleteColumnAtIndex(i: number) {
    setEditableColumns(oldEditableColumns => {
      if (oldEditableColumns.length === 1) {
        setColumns(['']);
        return [{id: 1, column: undefined}];
      }

      const newEditableColumns = [
        ...oldEditableColumns.slice(0, i),
        ...oldEditableColumns.slice(i + 1),
      ];

      setColumns(extractColumns(newEditableColumns));

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

        setColumns(extractColumns(newEditableColumns));

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
