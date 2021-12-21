import * as React from 'react';
import styled from '@emotion/styled';

import {Widget} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

type Props = {
  widget: Widget;
  dragId: string;
  isEditing: boolean;
  hideDragHandle?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  widgetLimitReached: boolean;
};

function SortableWidget({
  widget,
  isEditing,
  widgetLimitReached,
  hideDragHandle,
  onDelete,
  onEdit,
  onDuplicate,
}: Props) {
  const widgetProps = {
    widget,
    isEditing,
    widgetLimitReached,
    onDelete,
    onEdit,
    hideDragHandle,
    onDuplicate,
    showContextMenu: true,
    // TODO(nar): These aren't necessary for supporting RGL
    isSorting: false,
    currentWidgetDragging: false,
  };

  return (
    <WidgetWrapper>
      <WidgetCard {...widgetProps} />
    </WidgetWrapper>
  );
}

export default SortableWidget;

const WidgetWrapper = styled('div')`
  height: 100%;
`;
