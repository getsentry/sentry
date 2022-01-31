import * as React from 'react';
import LazyLoad from 'react-lazyload';
import {withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import {HeaderTitle} from 'sentry/components/charts/styles';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {IconDelete, IconEdit, IconGrabbable, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {DRAG_HANDLE_CLASS} from '../dashboard';
import {Widget, WidgetType} from '../types';
import {ISSUE_FIELD_TO_HEADER_MAP, ISSUE_FIELDS} from '../widget/issueWidget/fields';

import WidgetCardChart from './chart';
import IssueWidgetQueries from './issueWidgetQueries';
import WidgetCardContextMenu from './widgetCardContextMenu';
import WidgetQueries from './widgetQueries';

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type TableResultProps = Pick<WidgetQueries['state'], 'errorMessage' | 'loading'> & {
  transformedResults: TableDataRow[];
};

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  location: Location;
  isEditing: boolean;
  widget: Widget;
  selection: PageFilters;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  isSorting: boolean;
  currentWidgetDragging: boolean;
  showContextMenu?: boolean;
  isPreview?: boolean;
  hideToolbar?: boolean;
  draggableProps?: DraggableProps;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  noLazyLoad?: boolean;
  isMobile?: boolean;
  widgetLimitReached: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

class WidgetCard extends React.Component<Props> {
  isAllowWidgetsToDiscover() {
    const {organization} = this.props;
    return organization.features.includes('connect-discover-and-dashboards');
  }

  renderToolbar() {
    const {onEdit, onDelete, draggableProps, hideToolbar, isEditing, isMobile} =
      this.props;

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
    } = this.props;

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

  issueTableResultComponent({
    loading,
    errorMessage,
    transformedResults,
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
    return (
      <StyledSimpleTableChart
        location={location}
        title=""
        fields={widget.queries[0].fields}
        loading={loading}
        metadata={ISSUE_FIELDS}
        data={transformedResults}
        organization={organization}
        getCustomFieldRenderer={getIssueFieldRenderer}
        fieldHeaderMap={ISSUE_FIELD_TO_HEADER_MAP}
      />
    );
  }

  renderIssueChart() {
    const {widget, api, organization, selection, renderErrorMessage, tableItemLimit} =
      this.props;
    return (
      <IssueWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
      >
        {({transformedResults, errorMessage, loading}) => {
          return (
            <React.Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <LoadingScreen loading={loading} />
              {this.issueTableResultComponent({
                transformedResults,
                loading,
                errorMessage,
              })}
              {this.renderToolbar()}
            </React.Fragment>
          );
        }}
      </IssueWidgetQueries>
    );
  }

  renderDiscoverChart() {
    const {
      widget,
      api,
      organization,
      selection,
      renderErrorMessage,
      location,
      router,
      tableItemLimit,
      isMobile,
      windowWidth,
    } = this.props;
    return (
      <WidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
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
                isMobile={isMobile}
                windowWidth={windowWidth}
              />
              {this.renderToolbar()}
            </React.Fragment>
          );
        }}
      </WidgetQueries>
    );
  }

  renderChart() {
    const {widget} = this.props;

    if (widget.widgetType === WidgetType.ISSUE) {
      return this.renderIssueChart();
    }
    return this.renderDiscoverChart();
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

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
`;
