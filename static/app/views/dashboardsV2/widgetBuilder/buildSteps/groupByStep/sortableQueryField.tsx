import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useTheme} from '@emotion/react';

import space from 'sentry/styles/space';

import {QueryField, QueryFieldProps} from './queryField';

interface SortableItemProps extends Omit<QueryFieldProps, 'wrapperStyle'> {
  id: string;
}

export function SortableQueryField({id, ...props}: SortableItemProps) {
  const theme = useTheme();
  const {listeners, setNodeRef, transform, transition, isDragging} = useSortable({id});

  let style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: 'auto',
  } as React.CSSProperties;

  if (isDragging) {
    style = {
      ...style,
      zIndex: 100,
      height: '41px',
      border: `2px dashed ${theme.border}`,
      borderRadius: theme.borderRadius,
      margin: `0 ${space(3)} ${space(1)} ${space(3)}`,
    };
  }

  return (
    <QueryField
      forwardRef={setNodeRef}
      listeners={listeners}
      isDragging={isDragging}
      style={style}
      {...props}
    />
  );
}
