import {useSortable} from '@dnd-kit/sortable';

import {QueryField, QueryFieldProps} from './queryField';

interface SortableItemProps extends Omit<QueryFieldProps, 'wrapperStyle'> {
  index: string;
  wrapperStyle(args: {
    index: number;
    isDragging: boolean;
    isSorting: boolean;
  }): React.CSSProperties;
}

export function SortableQueryField({index, wrapperStyle, ...props}: SortableItemProps) {
  const {isSorting, isDragging, listeners, setNodeRef, transform, transition} =
    useSortable({
      id: index,
    });

  return (
    <QueryField
      forwardRef={setNodeRef}
      listeners={listeners}
      transform={transform}
      transition={transition}
      wrapperStyle={wrapperStyle({
        index: Number(index),
        isDragging,
        isSorting,
      })}
      {...props}
    />
  );
}
