import * as React from 'react';
import LazyLoad from 'react-lazyload';
import {withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import * as qs from 'query-string';

import {Client} from 'sentry/api';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import {HeaderTitle} from 'sentry/components/charts/styles';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MenuItem from 'sentry/components/menuItem';
import {isSelectionEqual} from 'sentry/components/organizations/globalSelectionHeader/utils';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {IconDelete, IconEdit, IconGrabbable, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {GlobalSelection, Group, Organization} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withOrganization from 'sentry/utils/withOrganization';
import {ISSUE_FIELDS} from 'sentry/views/dashboardsV2/widget/issueWidget/fields';

import {DRAG_HANDLE_CLASS} from './gridLayout/dashboard';
import ContextMenu from './contextMenu';
import IssueWidgetQueries from './issueWidgetQueries';
import {Widget} from './types';
import WidgetQueries from './widgetQueries';

type TableResultProps = Pick<WidgetQueries['state'], 'errorMessage' | 'loading'> & {
  tableResults: Group[];
};

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
  isSorting: boolean;
  currentWidgetDragging: boolean;
  showContextMenu?: boolean;
  hideToolbar?: boolean;
  draggableProps?: DraggableProps;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  noLazyLoad?: boolean;
};

class IssueWidgetCard extends React.Component<Props> {
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

  transformTableResults(tableResults: Group[]): TableDataRow[] {
    return tableResults.map(({id, shortId, title, assignedTo, ...resultProps}) => {
      const transformedResultProps = {};
      Object.keys(resultProps).map(key => {
        const value = resultProps[key];
        transformedResultProps[key] = ['number', 'string'].includes(typeof value)
          ? value
          : String(value);
      });
      const transformedTableResults = {
        ...transformedResultProps,
        id,
        'issue.id': id,
        issue: shortId,
        title,
        'assignee.type': assignedTo?.type,
        'assignee.name': assignedTo?.name ?? '',
        'assignee.id': assignedTo?.id,
        'assignee.email': assignedTo?.email ?? '',
      };
      return transformedTableResults;
    });
  }

  tableResultComponent({
    loading,
    errorMessage,
    tableResults,
  }: TableResultProps): React.ReactNode {
    const {location, organization, widget} = this.props;
    if (errorMessage) {
      return (
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    if (loading) {
      // Align height to other charts.
      return <LoadingPlaceholder height="200px" />;
    }
    const transformedTableResults = this.transformTableResults(tableResults);

    return (
      <StyledSimpleTableChart
        location={location}
        title=""
        fields={widget.queries[0].fields}
        loading={loading}
        metadata={ISSUE_FIELDS}
        data={transformedTableResults}
        organization={organization}
      />
    );
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
              className={DRAG_HANDLE_CLASS}
              {...draggableProps?.listeners}
              {...draggableProps?.attributes}
            />
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

  renderContextMenu() {
    const {widget, selection, organization, showContextMenu} = this.props;

    if (!showContextMenu) {
      return null;
    }

    const {start, end, utc, period} = selection.datetime;
    const datetime =
      start && end
        ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
        : {statsPeriod: period};
    const issuesLocation = `/organizations/${organization.slug}/issues/?${qs.stringify({
      query: widget.queries?.[0]?.conditions,
      ...datetime,
    })}`;

    return (
      <ContextWrapper>
        <ContextMenu>
          <Link to={issuesLocation}>
            <StyledMenuItem>{t('Open in Issues')}</StyledMenuItem>
          </Link>
        </ContextMenu>
      </ContextWrapper>
    );
  }

  renderChart() {
    const {widget, api, organization, selection, renderErrorMessage} = this.props;
    return (
      <IssueWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
      >
        {({tableResults, errorMessage, loading}) => {
          return (
            <React.Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <LoadingScreen loading={loading} />
              {this.tableResultComponent({tableResults, loading, errorMessage})}
              {this.renderToolbar()}
            </React.Fragment>
          );
        }}
      </IssueWidgetQueries>
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

export default withApi(
  withOrganization(withGlobalSelection(withRouter(IssueWidgetCard)))
);

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LoadingScreen = ({loading}: {loading: boolean}) => {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
};
const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface200};
`;

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

const WidgetTitle = styled(HeaderTitle)`
  ${overflowEllipsis};
`;

const WidgetHeader = styled('div')`
  padding: ${space(2)} ${space(3)} 0 ${space(3)};
  width: 100%;
  display: flex;
  justify-content: space-between;
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
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

const ContextWrapper = styled('div')`
  margin-left: ${space(1)};
`;

const StyledMenuItem = styled(MenuItem)`
  white-space: nowrap;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  &:hover {
    cursor: grab;
  }
`;
