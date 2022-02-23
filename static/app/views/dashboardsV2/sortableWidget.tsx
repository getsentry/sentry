import {ComponentProps, useEffect} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {Organization} from 'sentry/types';
import theme from 'sentry/utils/theme';
import withOrganization from 'sentry/utils/withOrganization';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

import {Widget} from './types';
import DnDKitWidgetWrapper from './widgetWrapper';

const TABLE_ITEM_LIMIT = 20;

type Props = {
  dragId: string;
  isEditing: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  organization: Organization;
  widget: Widget;
  widgetLimitReached: boolean;
  isMobile?: boolean;
  isPreview?: boolean;
  windowWidth?: number;
};

function SortableWidget(props: Props) {
  const {
    organization,
    widget,
    dragId,
    isEditing,
    widgetLimitReached,
    onDelete,
    onEdit,
    onDuplicate,
    isPreview,
    isMobile,
    windowWidth,
  } = props;

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

  let widgetProps: ComponentProps<typeof WidgetCard> = {
    widget,
    isEditing,
    widgetLimitReached,
    onDelete,
    onEdit,
    onDuplicate,
    isSorting,
    hideToolbar: isSorting,
    currentWidgetDragging,
    showContextMenu: true,
    isPreview,
    showWidgetViewerButton: organization.features.includes('widget-viewer-modal'),
  };

  if (organization.features.includes('dashboard-grid-layout')) {
    widgetProps = {
      ...widgetProps,
      isMobile,
      windowWidth,
      // TODO(nar): These aren't necessary for supporting RGL
      isSorting: false,
      currentWidgetDragging: false,
      tableItemLimit: TABLE_ITEM_LIMIT,
    };
    return (
      <GridWidgetWrapper>
        <WidgetCard {...widgetProps} />
      </GridWidgetWrapper>
    );
  }

  const initialStyles: ComponentProps<typeof DnDKitWidgetWrapper>['animate'] = {
    zIndex: 'auto',
  };

  widgetProps = {...widgetProps, draggableProps: {attributes, listeners}};
  return (
    <DnDKitWidgetWrapper
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
      <WidgetCard {...widgetProps} />
    </DnDKitWidgetWrapper>
  );
}

export default withOrganization(SortableWidget);

const GridWidgetWrapper = styled('div')`
  height: 100%;
`;
