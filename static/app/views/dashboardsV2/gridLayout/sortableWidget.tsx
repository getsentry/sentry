import * as React from 'react';
import styled from '@emotion/styled';

import IssueWidgetCard from 'sentry/views/dashboardsV2/issueWidgetCard';
import {Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

type Props = {
  widget: Widget;
  dragId: string;
  isEditing: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

function SortableWidget({widget, isEditing, onDelete, onEdit}: Props) {
  const widgetProps = {
    widget,
    isEditing,
    onDelete,
    onEdit,
    showContextMenu: true,
    // TODO(nar): These aren't necessary for supporting RGL
    isSorting: false,
    currentWidgetDragging: false,
  };

  return (
    <WidgetWrapper>
      {widget.widgetType === WidgetType.ISSUE ? (
        <IssueWidgetCard {...widgetProps} />
      ) : (
        <WidgetCard {...widgetProps} />
      )}
    </WidgetWrapper>
  );
}

export default SortableWidget;

const WidgetWrapper = styled('div')`
  height: 100%;
`;
