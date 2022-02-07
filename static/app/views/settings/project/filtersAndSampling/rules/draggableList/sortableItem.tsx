import * as React from 'react';
import {UniqueIdentifier} from '@dnd-kit/core';
import {useSortable} from '@dnd-kit/sortable';

import Item from './item';

export type SortableItemProps = Pick<
  React.ComponentProps<typeof Item>,
  'renderItem' | 'index' | 'innerWrapperStyle'
> & {
  id: string;
  index: number;
  innerWrapperStyle(args: {
    id: UniqueIdentifier;
    index: number;
    isDragOverlay: boolean;
    isDragging: boolean;
    isSorting: boolean;
    overIndex: number;
  }): React.CSSProperties;
  wrapperStyle(args: {
    id: string;
    index: number;
    isDragging: boolean;
    isSorting: boolean;
  }): React.CSSProperties;
  disabled?: boolean;
};

function SortableItem({
  id,
  index,
  renderItem,
  disabled,
  wrapperStyle,
  innerWrapperStyle,
}: SortableItemProps) {
  const {
    attributes,
    isSorting,
    isDragging,
    listeners,
    setNodeRef,
    overIndex,
    transform,
    transition,
  } = useSortable({id, disabled});

  return (
    <Item
      forwardRef={setNodeRef}
      value={id}
      sorting={isSorting}
      renderItem={renderItem}
      index={index}
      transform={transform}
      transition={transition}
      listeners={listeners}
      attributes={attributes}
      wrapperStyle={wrapperStyle({id, index, isDragging, isSorting})}
      innerWrapperStyle={innerWrapperStyle({
        id,
        index,
        isDragging,
        isSorting,
        overIndex,
        isDragOverlay: false,
      })}
    />
  );
}

export default SortableItem;
