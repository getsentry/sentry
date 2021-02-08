import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {IconAdd} from 'app/icons';

import {WidgetWrapper} from './styles';

export const ADD_WIDGET_BUTTON_DRAG_ID = 'add-widget-button';

function AddWidget(props: {onClick: () => void}) {
  const {onClick} = props;

  const initialStyles = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  };

  const {setNodeRef, transform} = useSortable({
    disabled: true,
    id: ADD_WIDGET_BUTTON_DRAG_ID,
    transition: null,
  });

  return (
    <WidgetWrapper
      key="add"
      ref={setNodeRef}
      displayType="big_number"
      layoutId={ADD_WIDGET_BUTTON_DRAG_ID}
      style={{originX: 0, originY: 0}}
      animate={
        transform
          ? {
              x: transform.x,
              y: transform.y,
              scaleX: transform?.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
              scaleY: transform?.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1,
            }
          : initialStyles
      }
      transition={{
        duration: 0.25,
      }}
    >
      <AddWidgetWrapper key="add" data-test-id="widget-add" onClick={onClick}>
        <IconAdd size="lg" isCircled color="inactive" />
      </AddWidgetWrapper>
    </WidgetWrapper>
  );
}

const AddWidgetWrapper = styled('a')`
  width: 100%;
  height: 110px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default AddWidget;
