import * as React from 'react';
import LazyLoad from 'react-lazyload';
import {withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';

import {openWidgetViewerModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import {HeaderTitle} from 'sentry/components/charts/styles';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {IconCopy, IconDelete, IconEdit, IconExpand, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {DRAG_HANDLE_CLASS} from '../dashboard';
import {Widget} from '../types';

import WidgetCardChartContainer from './widgetCardChartContainer';
import WidgetCardContextMenu from './widgetCardContextMenu';

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = WithRouterProps & {
  api: Client;
  currentWidgetDragging: boolean;
  isEditing: boolean;
  isSorting: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLimitReached: boolean;
  draggableProps?: DraggableProps;
  hideToolbar?: boolean;
  isMobile?: boolean;
  isPreview?: boolean;
  noLazyLoad?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showContextMenu?: boolean;
  showWidgetViewerButton?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

class WidgetCard extends React.Component<Props> {
  renderToolbar() {
    const {
      onEdit,
      onDelete,
      onDuplicate,
      draggableProps,
      hideToolbar,
      isEditing,
      isMobile,
    } = this.props;

    if (!isEditing) {
      return null;
    }

    return (
      <ToolbarPanel>
        <IconContainer style={{visibility: hideToolbar ? 'hidden' : 'visible'}}>
          {!isMobile && (
            <IconClick>
              <StyledIconGrabbable
                color="textColor"
                className={DRAG_HANDLE_CLASS}
                {...draggableProps?.listeners}
                {...draggableProps?.attributes}
              />
            </IconClick>
          )}
          <IconClick data-test-id="widget-edit" onClick={onEdit}>
            <IconEdit color="textColor" />
          </IconClick>
          <IconClick aria-label={t('Duplicate Widget')} onClick={onDuplicate}>
            <IconCopy color="textColor" />
          </IconClick>
          <IconClick data-test-id="widget-delete" onClick={onDelete}>
            <IconDelete color="textColor" />
          </IconClick>
        </IconContainer>
      </ToolbarPanel>
    );
  }

  renderContextMenu() {
    const {
      widget,
      selection,
      organization,
      showContextMenu,
      isPreview,
      widgetLimitReached,
      onEdit,
      onDuplicate,
      onDelete,
      isEditing,
    } = this.props;

    if (isEditing) {
      return null;
    }

    return (
      <WidgetCardContextMenu
        organization={organization}
        widget={widget}
        selection={selection}
        showContextMenu={showContextMenu}
        isPreview={isPreview}
        widgetLimitReached={widgetLimitReached}
        onDuplicate={onDuplicate}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  render() {
    const {
      api,
      organization,
      selection,
      widget,
      isMobile,
      renderErrorMessage,
      tableItemLimit,
      windowWidth,
      noLazyLoad,
      location,
      showWidgetViewerButton,
      router,
      isEditing,
    } = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel isDragging={false}>
          <WidgetHeader>
            <Tooltip title={widget.title} containerDisplayMode="grid" showOnlyOnOverflow>
              <WidgetTitle>{widget.title}</WidgetTitle>
            </Tooltip>
            {showWidgetViewerButton && !isEditing && (
              <OpenWidgetViewerButton
                aria-label={t('Open Widget Viewer')}
                onClick={() => {
                  if (widget.id) {
                    router.push({
                      pathname: `${location.pathname}widget/${widget.id}/`,
                      query: location.query,
                    });
                  } else {
                    openWidgetViewerModal({
                      organization,
                      widget,
                    });
                  }
                }}
              />
            )}
            {this.renderContextMenu()}
          </WidgetHeader>
          {noLazyLoad ? (
            <WidgetCardChartContainer
              api={api}
              organization={organization}
              selection={selection}
              widget={widget}
              isMobile={isMobile}
              renderErrorMessage={renderErrorMessage}
              tableItemLimit={tableItemLimit}
              windowWidth={windowWidth}
            />
          ) : (
            <LazyLoad once resize height={200}>
              <WidgetCardChartContainer
                api={api}
                organization={organization}
                selection={selection}
                widget={widget}
                isMobile={isMobile}
                renderErrorMessage={renderErrorMessage}
                tableItemLimit={tableItemLimit}
                windowWidth={windowWidth}
              />
            </LazyLoad>
          )}
          {this.renderToolbar()}
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withApi(withOrganization(withPageFilters(withRouter(WidgetCard))));

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel, {
  shouldForwardProp: prop => prop !== 'isDragging',
})<{
  isDragging: boolean;
}>`
  margin: 0;
  visibility: ${p => (p.isDragging ? 'hidden' : 'visible')};
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
  min-height: 96px;
  display: flex;
  flex-direction: column;
`;

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;

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

const WidgetTitle = styled(HeaderTitle)`
  ${overflowEllipsis};
  font-weight: normal;
`;

const WidgetHeader = styled('div')`
  padding: ${space(2)} ${space(3)} 0 ${space(3)};
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const OpenWidgetViewerButton = styled(IconExpand)`
  &:hover {
    cursor: pointer;
  }
  margin: auto;
  margin-left: ${space(0.5)};
  height: ${p => p.theme.fontSizeMedium};
  min-width: ${p => p.theme.fontSizeMedium};
`;
