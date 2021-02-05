// eslint-disable-next-line sentry/no-react-hooks
import React, {useEffect} from 'react';
import {useSortable} from '@dnd-kit/sortable';

import theme from 'app/utils/theme';

import {WidgetWrapper} from './styles';
import {Widget} from './types';
import WidgetCard from './widgetCard';

type Props = {
  widget: Widget;
  dragId: string;
  isEditing: boolean;
  isDragging: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

function SortableWidget(props: Props) {
  const {widget, dragId, isDragging, isEditing, onDelete, onEdit} = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: currentWidgetDragging,
  } = useSortable({
    id: dragId,
    transition: null,
  });

  useEffect(() => {
    if (!currentWidgetDragging) {
      return undefined;
    }

    document.body.style.cursor = 'grabbing';

    return function cleanup() {
      document.body.style.cursor = '';
    };
  }, [currentWidgetDragging]);

  const initialStyles = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 0,
  };

  return (
    <WidgetWrapper
      ref={setNodeRef}
      displayType={widget.displayType}
      layoutId={dragId}
      style={{
        originX: 0,
        originY: 0,
        boxShadow: currentWidgetDragging
          ? '0 0 0 1px rgba(63, 63, 68, 0.05), 0px 15px 15px 0 rgba(34, 33, 81, 0.25)'
          : 'none',
      }}
      animate={
        transform
          ? {
              x: transform.x,
              y: transform.y,
              scaleX: transform?.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
              scaleY: transform?.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1,
              zIndex: currentWidgetDragging ? theme.zIndex.modal : 0,
            }
          : initialStyles
      }
      transition={{
        duration: !currentWidgetDragging ? 0.25 : 0,
        easings: {
          type: 'spring',
        },
      }}
    >
      <WidgetCard
        widget={widget}
        isEditing={isEditing}
        onDelete={onDelete}
        onEdit={onEdit}
        isDragging={isDragging}
        hideToolbar={isDragging}
        currentWidgetDragging={currentWidgetDragging}
        draggableProps={{
          attributes,
          listeners,
        }}
      />
    </WidgetWrapper>
  );
}

export default SortableWidget;
