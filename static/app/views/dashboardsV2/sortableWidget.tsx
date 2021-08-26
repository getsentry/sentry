import {useEffect} from 'react';
import * as React from 'react';
import {useSortable} from '@dnd-kit/sortable';

import theme from 'app/utils/theme';

import {Widget} from './types';
import WidgetCard from './widgetCard';
import WidgetWrapper from './widgetWrapper';

const initialStyles: React.ComponentProps<typeof WidgetWrapper>['animate'] = {
  zIndex: 'auto',
};

type Props = {
  widget: Widget;
  dragId: string;
  isEditing: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

function SortableWidget(props: Props) {
  const {widget, dragId, isEditing, onDelete, onEdit} = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: currentWidgetDragging,
    isSorting,
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

  return (
    <WidgetWrapper
      ref={setNodeRef}
      displayType={widget.displayType}
      layoutId={dragId}
      style={{
        // Origin is set to top right-hand corner where the drag handle is placed.
        // Otherwise, set the origin to be the top left-hand corner when swapping widgets.
        originX: currentWidgetDragging ? 1 : 0,
        originY: 0,
        boxShadow: currentWidgetDragging ? theme.dropShadowHeavy : 'none',
        borderRadius: currentWidgetDragging ? theme.borderRadius : undefined,
      }}
      animate={
        transform
          ? {
              x: transform.x,
              y: transform.y,
              scaleX: transform?.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
              scaleY: transform?.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1,
              zIndex: currentWidgetDragging ? theme.zIndex.modal : 'auto',
            }
          : initialStyles
      }
      transformTemplate={(___transform, generatedTransform) => {
        if (isEditing && !!transform) {
          return generatedTransform;
        }
        return 'none';
      }}
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
        isSorting={isSorting}
        hideToolbar={isSorting}
        currentWidgetDragging={currentWidgetDragging}
        draggableProps={{
          attributes,
          listeners,
        }}
        showContextMenu
      />
    </WidgetWrapper>
  );
}

export default SortableWidget;
