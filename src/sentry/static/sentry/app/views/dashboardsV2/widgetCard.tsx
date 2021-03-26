import React, {MouseEvent} from 'react';
import * as ReactRouter from 'react-router';
import {browserHistory} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import {HeaderTitle} from 'app/components/charts/styles';
import DropdownMenu from 'app/components/dropdownMenu';
import ErrorBoundary from 'app/components/errorBoundary';
import MenuItem from 'app/components/menuItem';
import {isSelectionEqual} from 'app/components/organizations/globalSelectionHeader/utils';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconDelete, IconEdit, IconEllipsis, IconGrabbable} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import {Widget} from './types';
import {eventViewFromWidget} from './utils';
import WidgetCardChart from './widgetCardChart';
import WidgetQueries from './widgetQueries';

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = ReactRouter.WithRouterProps & {
  api: Client;
  organization: Organization;
  location: Location;
  isEditing: boolean;
  widget: Widget;
  selection: GlobalSelection;
  onDelete: () => void;
  onEdit: () => void;
  isSorting: boolean;
  currentWidgetDragging: boolean;
  showContextMenu?: boolean;
  hideToolbar?: boolean;
  draggableProps?: DraggableProps;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
};

class WidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    if (
      !isEqual(nextProps.widget, this.props.widget) ||
      !isSelectionEqual(nextProps.selection, this.props.selection) ||
      this.props.isEditing !== nextProps.isEditing ||
      this.props.isSorting !== nextProps.isSorting ||
      this.props.hideToolbar !== nextProps.hideToolbar
    ) {
      return true;
    }
    return false;
  }

  renderToolbar() {
    const {onEdit, onDelete, draggableProps, hideToolbar, isEditing} = this.props;

    if (!isEditing) {
      return null;
    }

    return (
      <ToolbarPanel>
        <IconContainer style={{visibility: hideToolbar ? 'hidden' : 'visible'}}>
          <IconClick>
            <StyledIconGrabbable
              color="textColor"
              {...draggableProps?.listeners}
              {...draggableProps?.attributes}
            />
          </IconClick>
          <IconClick
            data-test-id="widget-edit"
            onClick={() => {
              onEdit();
            }}
          >
            <IconEdit color="textColor" />
          </IconClick>
          <IconClick
            data-test-id="widget-delete"
            onClick={() => {
              onDelete();
            }}
          >
            <IconDelete color="textColor" />
          </IconClick>
        </IconContainer>
      </ToolbarPanel>
    );
  }

  renderContextMenu() {
    const {widget, selection, organization, showContextMenu} = this.props;

    if (!showContextMenu) {
      return null;
    }

    const menuOptions: React.ReactNode[] = [];

    if (
      widget.displayType === 'table' &&
      organization.features.includes('discover-basic')
    ) {
      // Open table widget in Discover

      if (widget.queries.length) {
        // We expect Table widgets to have only one query.
        const query = widget.queries[0];

        const eventView = eventViewFromWidget(widget.title, query, selection);

        menuOptions.push(
          <MenuItem
            key="open-discover"
            onClick={event => {
              event.preventDefault();
              trackAnalyticsEvent({
                eventKey: 'dashboards2.tablewidget.open_in_discover',
                eventName: 'Dashboards2: Table Widget - Open in Discover',
                organization_id: parseInt(this.props.organization.id, 10),
              });
              browserHistory.push(eventView.getResultsViewUrlTarget(organization.slug));
            }}
          >
            {t('Open in Discover')}
          </MenuItem>
        );
      }
    }

    if (!menuOptions.length) {
      return null;
    }

    return (
      <ContextWrapper>
        <ContextMenu>{menuOptions}</ContextMenu>
      </ContextWrapper>
    );
  }

  render() {
    const {
      widget,
      api,
      organization,
      selection,
      renderErrorMessage,
      location,
      router,
    } = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel isDragging={false}>
          <WidgetHeader>
            <WidgetTitle>{widget.title}</WidgetTitle>
            {this.renderContextMenu()}
          </WidgetHeader>
          <WidgetQueries
            api={api}
            organization={organization}
            widget={widget}
            selection={selection}
          >
            {({tableResults, timeseriesResults, errorMessage, loading}) => {
              return (
                <React.Fragment>
                  {typeof renderErrorMessage === 'function'
                    ? renderErrorMessage(errorMessage)
                    : null}
                  <WidgetCardChart
                    timeseriesResults={timeseriesResults}
                    tableResults={tableResults}
                    errorMessage={errorMessage}
                    loading={loading}
                    location={location}
                    widget={widget}
                    selection={selection}
                    router={router}
                    organization={organization}
                  />
                  {this.renderToolbar()}
                </React.Fragment>
              );
            }}
          </WidgetQueries>
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withApi(
  withOrganization(withGlobalSelection(ReactRouter.withRouter(WidgetCard)))
);

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
`;

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;

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
`;

const WidgetHeader = styled('div')`
  padding: ${space(2)} ${space(3)} 0 ${space(3)};
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const ContextMenu = ({children}) => (
  <DropdownMenu>
    {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
      const topLevelCx = classNames('dropdown', {
        'anchor-right': true,
        open: isOpen,
      });

      return (
        <MoreOptions
          {...getRootProps({
            className: topLevelCx,
          })}
        >
          <DropdownTarget
            {...getActorProps({
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();
              },
            })}
          >
            <IconEllipsis data-test-id="context-menu" size="md" />
          </DropdownTarget>
          {isOpen && (
            <ul {...getMenuProps({})} className={classNames('dropdown-menu')}>
              {children}
            </ul>
          )}
        </MoreOptions>
      );
    }}
  </DropdownMenu>
);

const MoreOptions = styled('span')`
  display: flex;
  color: ${p => p.theme.textColor};
`;

const DropdownTarget = styled('div')`
  display: flex;
  cursor: pointer;
`;

const ContextWrapper = styled('div')`
  margin-left: ${space(1)};
`;
