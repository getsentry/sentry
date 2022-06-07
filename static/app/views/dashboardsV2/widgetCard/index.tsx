import {Component} from 'react';
import LazyLoad from 'react-lazyload';
import {withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {IconCopy, IconDelete, IconEdit, IconGrabbable} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {statsPeriodToDays} from 'sentry/utils/dates';
import {TableDataRow, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {DRAG_HANDLE_CLASS} from '../dashboard';
import {Widget, WidgetType} from '../types';

import {DashboardsMEPConsumer, DashboardsMEPProvider} from './dashboardsMEPContext';
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
  index?: string;
  isMobile?: boolean;
  isPreview?: boolean;
  noLazyLoad?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showContextMenu?: boolean;
  showStoredAlert?: boolean;
  showWidgetViewerButton?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

type State = {
  issuesData?: TableDataRow[];
  pageLinks?: string;
  seriesData?: Series[];
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
};

const METRICS_BACKED_SESSIONS_START_DATE = new Date('2022-04-12');

class WidgetCard extends Component<Props, State> {
  state: State = {};
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
            <GrabbableButton
              size="xsmall"
              aria-label={t('Drag Widget')}
              icon={<IconGrabbable />}
              borderless
              className={DRAG_HANDLE_CLASS}
              {...draggableProps?.listeners}
              {...draggableProps?.attributes}
            />
          )}
          <Button
            data-test-id="widget-edit"
            aria-label={t('Edit Widget')}
            size="xsmall"
            borderless
            onClick={onEdit}
            icon={<IconEdit />}
          />
          <Button
            aria-label={t('Duplicate Widget')}
            size="xsmall"
            borderless
            onClick={onDuplicate}
            icon={<IconCopy />}
          />
          <Button
            data-test-id="widget-delete"
            aria-label={t('Delete Widget')}
            borderless
            size="xsmall"
            onClick={onDelete}
            icon={<IconDelete />}
          />
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
      showWidgetViewerButton,
      router,
      location,
      index,
    } = this.props;

    const {seriesData, tableData, issuesData, pageLinks, totalIssuesCount} = this.state;

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
        showWidgetViewerButton={showWidgetViewerButton}
        router={router}
        location={location}
        index={index}
        seriesData={seriesData}
        tableData={tableData}
        issuesData={issuesData}
        pageLinks={pageLinks}
        totalIssuesCount={totalIssuesCount}
      />
    );
  }

  setData = ({
    tableResults,
    timeseriesResults,
    issuesResults,
    totalIssuesCount,
    pageLinks,
  }: {
    issuesResults?: TableDataRow[];
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    totalIssuesCount?: string;
  }) => {
    this.setState({
      seriesData: timeseriesResults,
      tableData: tableResults,
      issuesData: issuesResults,
      totalIssuesCount,
      pageLinks,
    });
  };

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
      showStoredAlert,
    } = this.props;
    const {start, period} = selection.datetime;
    let showIncompleteDataAlert: boolean = false;
    if (widget.widgetType === WidgetType.RELEASE && showStoredAlert) {
      if (start) {
        let startDate: Date | undefined = undefined;
        if (typeof start === 'string') {
          startDate = new Date(start);
        } else {
          startDate = start;
        }
        showIncompleteDataAlert = startDate < METRICS_BACKED_SESSIONS_START_DATE;
      } else if (period) {
        const periodInDays = statsPeriodToDays(period);
        const current = new Date();
        const prior = new Date(new Date().setDate(current.getDate() - periodInDays));
        showIncompleteDataAlert = prior < METRICS_BACKED_SESSIONS_START_DATE;
      }
    }
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <DashboardsMEPProvider>
          <WidgetCardPanel isDragging={false}>
            <WidgetHeader>
              <Tooltip
                title={widget.title}
                containerDisplayMode="grid"
                showOnlyOnOverflow
              >
                <WidgetTitle>{widget.title}</WidgetTitle>
              </Tooltip>
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
                onDataFetched={this.setData}
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
                  onDataFetched={this.setData}
                />
              </LazyLoad>
            )}
            {this.renderToolbar()}
          </WidgetCardPanel>
          <Feature organization={organization} features={['dashboards-mep']}>
            <DashboardsMEPConsumer>
              {({isMetricsData}) =>
                showStoredAlert &&
                widget.widgetType === WidgetType.DISCOVER &&
                isMetricsData === false && (
                  <StoredDataAlert showIcon>
                    {tct(
                      "Your selection is only applicable to [storedData: stored event data]. We've automatically adjusted your results.",
                      {
                        storedData: <ExternalLink href="https://docs.sentry.io/" />, // TODO(dashboards): Update the docs URL
                      }
                    )}
                  </StoredDataAlert>
                )
              }
            </DashboardsMEPConsumer>
          </Feature>
          <Feature organization={organization} features={['dashboards-releases']}>
            {showIncompleteDataAlert && (
              <StoredDataAlert showIcon>
                {tct(
                  'Releases data is only available from [date]. Data may be incomplete as a result.',
                  {
                    date: <DateTime date={METRICS_BACKED_SESSIONS_START_DATE} dateOnly />,
                  }
                )}
              </StoredDataAlert>
            )}
          </Feature>
        </DashboardsMEPProvider>
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

export const WidgetCardPanel = styled(Panel, {
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
  margin: ${space(1)};
  touch-action: none;
`;

const GrabbableButton = styled(Button)`
  cursor: grab;
`;

const WidgetTitle = styled(HeaderTitle)`
  ${overflowEllipsis};
  font-weight: normal;
`;

const WidgetHeader = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StoredDataAlert = styled(Alert)`
  margin-top: ${space(1)};
  margin-bottom: 0;
`;
