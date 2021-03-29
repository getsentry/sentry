import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';

import WidgetWrapper from './widgetWrapper';

export const ADD_WIDGET_BUTTON_DRAG_ID = 'add-widget-button';

const initialStyles = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
};

type Props = {
  onClick: () => void;
  orgFeatures: Organization['features'];
  orgSlug: Organization['slug'];
};

function AddWidget({onClick, orgFeatures, orgSlug}: Props) {
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
      {orgFeatures.includes('metrics') ? (
        <InnerWrapper>
          <ButtonBar gap={1}>
            <Button to={`/organizations/${orgSlug}/dashboards/widget/new/`}>
              {t('Add metrics widget')}
            </Button>
            <Button onClick={onClick}>{t('Add events widget')}</Button>
          </ButtonBar>
        </InnerWrapper>
      ) : (
        <InnerWrapper onClick={onClick}>
          <AddButton
            data-test-id="widget-add"
            onClick={onClick}
            icon={<IconAdd size="lg" isCircled color="inactive" />}
          />
        </InnerWrapper>
      )}
    </WidgetWrapper>
  );
}

export default AddWidget;

const AddButton = styled(Button)`
  border: none;
  &,
  &:focus,
  &:active,
  &:hover {
    background: transparent;
    box-shadow: none;
  }
`;

const InnerWrapper = styled('div')<{onClick?: () => void}>`
  width: 100%;
  height: 110px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${p => (p.onClick ? 'pointer' : '')};
`;
