import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';

import {DisplayType} from './types';
import WidgetWrapper from './widgetWrapper';

export const ADD_WIDGET_BUTTON_DRAG_ID = 'add-widget-button';

const initialStyles = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
};

type Props = {
  onAddWidget: () => void;
};

function AddWidget({onAddWidget}: Props) {
  const {setNodeRef, transform} = useSortable({
    disabled: true,
    id: ADD_WIDGET_BUTTON_DRAG_ID,
    transition: null,
  });

  return (
    <WidgetWrapper
      key="add"
      ref={setNodeRef}
      displayType={DisplayType.BIG_NUMBER}
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
      <InnerWrapper onClick={onAddWidget}>
        <AddButton
          data-test-id="widget-add"
          icon={<IconAdd size="lg" isCircled color="inactive" />}
          aria-label={t('Add widget')}
        />
      </InnerWrapper>
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
