import {ComponentProps, useEffect} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import PanelAlert from 'sentry/components/panels/panelAlert';
import {Organization} from 'sentry/types';
import theme from 'sentry/utils/theme';
import withOrganization from 'sentry/utils/withOrganization';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

import {DashboardFilters, Widget} from './types';
import DnDKitWidgetWrapper from './widgetWrapper';

const TABLE_ITEM_LIMIT = 20;

type Props = {
  dragId: string;
  index: string;
  isEditing: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  organization: Organization;
  widget: Widget;
  widgetLimitReached: boolean;
  dashboardFilters?: DashboardFilters;
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
    index,
    dashboardFilters,
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
    index,
    dashboardFilters,
    renderErrorMessage: errorMessage => {
      return (
        typeof errorMessage === 'string' && (
          <PanelAlert type="error">{errorMessage}</PanelAlert>
        )
      );
    },
  };

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

export default withOrganization(SortableWidget);

const GridWidgetWrapper = styled('div')`
  height: 100%;
`;
