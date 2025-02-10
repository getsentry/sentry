import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function SortableVisualizeFieldWrapper({
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
    gap: space(1),
    width: '100%',
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
    <div ref={setNodeRef} style={style}>
      {canDrag && (
        <DragAndReorderButton
          {...listeners}
          {...attributes}
          aria-label={t('Drag to reorder')}
          icon={<IconGrabbable size="xs" />}
          size="zero"
          borderless
          isDragging={isDragging}
        />
      )}
      {children}
    </div>
  );
}

export default SortableVisualizeFieldWrapper;

const DragAndReorderButton = styled(Button)<{isDragging: boolean}>`
  height: ${p => p.theme.form.md.height}px;

  ${p => p.isDragging && p.theme.visuallyHidden}
`;
