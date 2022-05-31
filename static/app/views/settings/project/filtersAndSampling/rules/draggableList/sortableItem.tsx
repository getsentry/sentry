import {useSortable} from '@dnd-kit/sortable';

import {Item} from './item';

export type SortableItemProps = Pick<
  React.ComponentProps<typeof Item>,
  'renderItem' | 'index'
> & {
  id: string;
  index: number;
  wrapperStyle(args: {
    index: number;
    isDragging: boolean;
    isSorting: boolean;
  }): React.CSSProperties;
  disabled?: boolean;
};

export function SortableItem({
  id,
  index,
  renderItem,
  disabled,
  wrapperStyle,
}: SortableItemProps) {
  const {
    attributes,
    isSorting,
    isDragging,
    listeners,
    setNodeRef,
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
      wrapperStyle={wrapperStyle({index, isDragging, isSorting})}
    />
  );
}
