import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';

export function SortableVisualizeFieldWrapper({
  dragId,
  canDrag,
  children,
}: {
  canDrag: boolean;
  children: React.ReactNode;
  dragId: string;
}) {
  const theme = useTheme();
  const {listeners, setNodeRef, transform, transition, attributes, isDragging} =
    useSortable({
      id: dragId,
      transition: null,
      disabled: !canDrag,
    });

  let style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: 'auto',
    display: 'flex',
    gap: theme.space.xs,
    width: '100%',
  } as React.CSSProperties;

  if (isDragging) {
    style = {
      ...style,
      zIndex: 100,
      height: theme.form.md.height,
      border: `2px dashed ${theme.tokens.border.primary}`,
      borderRadius: theme.radius.md,
    };
  }

  return (
    <div ref={setNodeRef} style={style}>
      {canDrag && (
        <StyledDragReorderButton {...listeners} {...attributes} isDragging={isDragging} />
      )}
      {children}
    </div>
  );
}

const StyledDragReorderButton = styled(DragReorderButton)<{isDragging: boolean}>`
  height: ${p => p.theme.form.md.height};
  cursor: grab;

  ${p => p.isDragging && p.theme.visuallyHidden}
`;
