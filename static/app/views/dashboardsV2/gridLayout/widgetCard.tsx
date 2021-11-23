import {withRouter} from 'react-router';
import styled from '@emotion/styled';

import {IconDelete, IconEdit, IconGrabbable} from 'app/icons';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import {WidgetCard} from 'app/views/dashboardsV2/widgetCard';

export const DRAG_HANDLE_ID = 'grid-layout-drag-handle';

class GridWidgetCard extends WidgetCard {
  renderToolbar() {
    const {onEdit, onDelete, hideToolbar, isEditing} = this.props;

    if (!isEditing) {
      return null;
    }

    return (
      <ToolbarPanel>
        <IconContainer style={{visibility: hideToolbar ? 'hidden' : 'visible'}}>
          <IconClick>
            <StyledIconGrabbable id={DRAG_HANDLE_ID} color="textColor" />
          </IconClick>
          <IconClick data-test-id="widget-edit" onClick={onEdit}>
            <IconEdit color="textColor" />
          </IconClick>
          <IconClick data-test-id="widget-delete" onClick={onDelete}>
            <IconDelete color="textColor" />
          </IconClick>
        </IconContainer>
      </ToolbarPanel>
    );
  }
}

export default withApi(withOrganization(withGlobalSelection(withRouter(GridWidgetCard))));

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: auto;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  background-color: ${p => p.theme.overlayBackgroundAlpha};
  border-radius: ${p => p.theme.borderRadius};
`;

const IconContainer = styled('div')`
  display: flex;
  margin: 10px ${space(2)};
  touch-action: none;
`;

const IconClick = styled('div')`
  padding: ${space(1)};

  &:hover {
    cursor: pointer;
  }
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  &:hover {
    cursor: grab;
  }
`;
