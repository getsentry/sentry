import styled from '@emotion/styled';

import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

import {Widget} from './types';

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
  isMobile?: boolean;
  isPreview?: boolean;
  windowWidth?: number;
};

function SortableWidget(props: Props) {
  const {
    organization,
    widget,
    isEditing,
    widgetLimitReached,
    onDelete,
    onEdit,
    onDuplicate,
    isPreview,
    isMobile,
    windowWidth,
    index,
  } = props;

  return (
    <GridWidgetWrapper>
      <WidgetCard
        widget={widget}
        isEditing={isEditing}
        widgetLimitReached={widgetLimitReached}
        onDelete={onDelete}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        isPreview={isPreview}
        showWidgetViewerButton={organization.features.includes('widget-viewer-modal')}
        index={index}
        isMobile={isMobile}
        windowWidth={windowWidth}
        tableItemLimit={TABLE_ITEM_LIMIT}
        showContextMenu
      />
    </GridWidgetWrapper>
  );
}

export default withOrganization(SortableWidget);

const GridWidgetWrapper = styled('div')`
  height: 100%;
`;
