import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useTheme} from '@emotion/react';

import {QueryField, QueryFieldProps} from './queryField';

interface SortableItemProps extends QueryFieldProps {
  dragId: string;
}

export function SortableQueryField({dragId, ...props}: SortableItemProps) {
  const theme = useTheme();
  const {listeners, setNodeRef, transform, transition, attributes, isDragging} =
    useSortable({
      id: dragId,
      transition: null,
    });

  let style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: 'auto',
  } as React.CSSProperties;

  if (isDragging) {
    style = {
      ...style,
      zIndex: 100,
      height: theme.form.md.height,
      border: `2px dashed ${theme.border}`,
      borderRadius: theme.borderRadius,
    };
  }

  return (
    <QueryField
      forwardRef={setNodeRef}
      listeners={listeners}
      attributes={attributes}
      isDragging={isDragging}
      style={style}
      {...props}
    />
  );
}
