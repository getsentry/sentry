import {useSortable} from '@dnd-kit/sortable';

import {DraggableRuleListItem} from './draggableRuleListItem';

export type SortableItemProps = Pick<
  React.ComponentProps<typeof DraggableRuleListItem>,
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

export function DraggableRuleListSortableItem({
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
    <DraggableRuleListItem
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
