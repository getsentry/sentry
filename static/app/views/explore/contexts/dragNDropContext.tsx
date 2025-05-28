import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {
  type Column,
  useDragNDropColumns,
} from 'sentry/views/explore/hooks/useDragNDropColumns';

interface DragNDropContextProps<T> {
  children: (props: {
    deleteColumnAtIndex: (i: number) => void;
    editableColumns: Array<Column<T>>;
    insertColumn: (column?: T) => void;
    updateColumnAtIndex: (i: number, column: T) => void;
  }) => React.ReactNode;
  columns: T[];
  defaultColumn: () => T;
  setColumns: (columns: T[], op: 'insert' | 'update' | 'delete' | 'reorder') => void;
}

export function DragNDropContext<T>({
  columns,
  defaultColumn,
  setColumns,
  children,
}: DragNDropContextProps<T>) {
  const {
    editableColumns,
    insertColumn,
    updateColumnAtIndex,
    deleteColumnAtIndex,
    onDragEnd,
  } = useDragNDropColumns({
    columns,
    defaultColumn,
    setColumns,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={editableColumns} strategy={verticalListSortingStrategy}>
        {children({
          editableColumns,
          insertColumn,
          updateColumnAtIndex,
          deleteColumnAtIndex,
        })}
      </SortableContext>
    </DndContext>
  );
}
