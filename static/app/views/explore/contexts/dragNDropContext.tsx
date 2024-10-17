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

import {type Column, useDragNDropColumns} from '../hooks/useDragNDropColumns';

interface DragNDropContextProps {
  children: (props: {
    deleteColumnAtIndex: (i: number) => void;
    editableColumns: Column[];
    insertColumn: () => void;
    updateColumnAtIndex: (i: number, column: string) => void;
  }) => React.ReactNode;
  columns: string[];
  setColumns: (columns: string[]) => void;
}

export function DragNDropContext({columns, setColumns, children}: DragNDropContextProps) {
  const {
    editableColumns,
    insertColumn,
    updateColumnAtIndex,
    deleteColumnAtIndex,
    onDragEnd,
  } = useDragNDropColumns({columns, setColumns});

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
