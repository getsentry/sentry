import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {IconDelete, IconEdit, IconGrabbable} from 'app/icons';
import space from 'app/styles/space';

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = {
  onDelete: () => void;
  onEdit: () => void;
  isEditing: boolean;
  draggableProps?: DraggableProps;
  hideToolbar?: boolean;
};

function WidgetCardToolbar({
  onEdit,
  onDelete,
  draggableProps,
  hideToolbar,
  isEditing,
}: Props) {
  if (!isEditing) {
    return null;
  }

  return (
    <ToolbarPanel>
      <IconContainer style={{visibility: hideToolbar ? 'hidden' : 'visible'}}>
        <IconClick>
          <StyledIconGrabbable
            color="textColor"
            {...draggableProps?.listeners}
            {...draggableProps?.attributes}
          />
        </IconClick>
        <IconClick
          data-test-id="widget-edit"
          onClick={() => {
            onEdit();
          }}
        >
          <IconEdit color="textColor" />
        </IconClick>
        <IconClick
          data-test-id="widget-delete"
          onClick={() => {
            onDelete();
          }}
        >
          <IconDelete color="textColor" />
        </IconClick>
      </IconContainer>
    </ToolbarPanel>
  );
}

export default WidgetCardToolbar;

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  background-color: ${p => p.theme.overlayBackgroundAlpha};
  border-radius: ${p => p.theme.borderRadius};
`;

const IconContainer = styled('div')`
  display: flex;
  margin: 10px ${space(2)};
  touch-action: none;
`;

const IconClick = styled('div')`
  padding: ${space(1)};

  &:hover {
    cursor: pointer;
  }
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  &:hover {
    cursor: grab;
  }
`;
