import * as React from 'react';
import LazyLoad from 'react-lazyload';
import {Link, withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {openDashboardWidgetQuerySelectorModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import ActionLink from 'sentry/components/actions/actionLink';
import ActionButton from 'sentry/components/actions/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import DropdownLink from 'sentry/components/dropdownLink';
import ErrorBoundary from 'sentry/components/errorBoundary';
import MenuItem from 'sentry/components/menuItem';
import {isSelectionEqual} from 'sentry/components/organizations/globalSelectionHeader/utils';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {IconCopy, IconDelete, IconEdit, IconEllipsis, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {GlobalSelection, Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {DisplayModes} from 'sentry/utils/discover/types';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withOrganization from 'sentry/utils/withOrganization';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';
import {DisplayType} from 'sentry/views/dashboardsV2/widget/utils';

import {DRAG_HANDLE_CLASS} from './gridLayout/dashboard';
import ContextMenu from './contextMenu';
import {Widget} from './types';
import WidgetCardChart from './widgetCardChart';
import WidgetQueries from './widgetQueries';

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  location: Location;
  isEditing: boolean;
  widget: Widget;
  selection: GlobalSelection;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  isSorting: boolean;
  currentWidgetDragging: boolean;
  showContextMenu?: boolean;
  hideToolbar?: boolean;
  draggableProps?: DraggableProps;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  noLazyLoad?: boolean;
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

  isAllowWidgetsToDiscover() {
    const {organization} = this.props;
    return organization.features.includes('connect-discover-and-dashboards');
  }

  renderToolbar() {
    const {onEdit, onDelete, onDuplicate, draggableProps, hideToolbar, isEditing} =
      this.props;

    if (!isEditing) {
      return null;
    }

    const contextMenu = (
      <EditContextWrapper>
        <DropdownLink
          key="actions"
          anchorMiddle
          customTitle={
            <ActionButton label={t('Widget Actions')} icon={<IconEllipsis size="xs" />} />
          }
        >
          <MenuItem
            data-test-id="widget-edit"
            icon={<IconEdit color="textColor" />}
            onClick={event => {
              event.preventDefault();
              onEdit();
            }}
          >
            {t('Edit')}
          </MenuItem>
          <DangerMenuItem
            data-test-id="widget-delete"
            icon={<IconDelete color="red300" />}
            onClick={event => {
              event.preventDefault();
              onDelete();
            }}
          >
            {t('Delete')}
          </DangerMenuItem>
        </DropdownLink>
      </EditContextWrapper>
    );

    return (
      <ToolbarPanel>
        <IconContainer style={{visibility: hideToolbar ? 'hidden' : 'visible'}}>
          <IconClick>
            <StyledIconGrabbable
              color="textColor"
              className={DRAG_HANDLE_CLASS}
              {...draggableProps?.listeners}
              {...draggableProps?.attributes}
            />
          </IconClick>
          <Wrapper>
            <StyledActionLink
              type="button"
              onAction={() => onDuplicate()}
              title={t('Duplicate')}
              icon={<IconCopy />}
            >
              {t('Duplicate')}
            </StyledActionLink>
            {contextMenu}
          </Wrapper>
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
      (widget.displayType === 'table' || this.isAllowWidgetsToDiscover()) &&
      organization.features.includes('discover-basic')
    ) {
      // Open Widget in Discover
      if (widget.queries.length) {
        const eventView = eventViewFromWidget(
          widget.title,
          widget.queries[0],
          selection,
          widget.displayType
        );
        const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug);
        if (this.isAllowWidgetsToDiscover()) {
          // Pull a max of 3 valid Y-Axis from the widget
          const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
          discoverLocation.query.yAxis = widget.queries[0].fields
            .filter(field => yAxisOptions.includes(field))
            .slice(0, 3);
          switch (widget.displayType) {
            case DisplayType.WORLD_MAP:
              discoverLocation.query.display = DisplayModes.WORLDMAP;
              break;
            case DisplayType.BAR:
              discoverLocation.query.display = DisplayModes.BAR;
              break;
            default:
              break;
          }
        }
        if (widget.queries.length === 1) {
          menuOptions.push(
            <Link
              key="open-discover-link"
              to={discoverLocation}
              onClick={() => {
                trackAdvancedAnalyticsEvent('dashboards_views.open_in_discover.opened', {
                  organization,
                  widget_type: widget.displayType,
                });
              }}
            >
              <StyledMenuItem key="open-discover">{t('Open in Discover')}</StyledMenuItem>
            </Link>
          );
        } else {
          menuOptions.push(
            <StyledMenuItem
              key="open-discover"
              onClick={event => {
                event.preventDefault();
                trackAdvancedAnalyticsEvent('dashboards_views.query_selector.opened', {
                  organization,
                  widget_type: widget.displayType,
                });
                openDashboardWidgetQuerySelectorModal({organization, widget});
              }}
            >
              {t('Open in Discover')}
            </StyledMenuItem>
          );
        }
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

  renderChart() {
    const {widget, api, organization, selection, renderErrorMessage, location, router} =
      this.props;
    return (
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
    );
  }

  render() {
    const {widget, noLazyLoad} = this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel isDragging={false}>
          <WidgetHeader>
            <WidgetTitle>{widget.title}</WidgetTitle>
            {this.renderContextMenu()}
          </WidgetHeader>
          {noLazyLoad ? (
            this.renderChart()
          ) : (
            <LazyLoad once resize height={200}>
              {this.renderChart()}
            </LazyLoad>
          )}
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withApi(withOrganization(withGlobalSelection(withRouter(WidgetCard))));

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
  z-index: auto;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  background-color: ${p => p.theme.overlayBackgroundAlpha};
  border-radius: ${p => p.theme.borderRadius};
`;

const SizeSelectContainer = styled(`div`)`
  width: 120px;
  height: 26px;
  margin-right: ${space(1)};
`;

const IconContainer = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;

  justify-content: space-between;
  width: 100%;

  display: flex;
  align-items: flex-start;
  margin-right: ${space(2)};
  margin-bottom: 10px;
  touch-action: none;
`;

const IconClick = styled('div')`
  padding: ${space(1)};

  &:hover {
    cursor: pointer;
  }
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  margin-left: ${space(2)};
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

const ContextWrapper = styled('div')`
  margin-left: ${space(1)};
`;

const Wrapper = styled('div')`
  display: flex;
`;

const EditContextWrapper = styled('div')`
  margin-right: ${space(3)};
`;

const StyledMenuItem = styled(MenuItem)`
  white-space: nowrap;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const DangerMenuItem = styled(MenuItem)`
  color: ${p => p.theme.red300};
`;

const StyledActionLink = styled(ActionLink)`
  padding: ${space(0.75)};
  margin-right: ${space(1)};
`;
