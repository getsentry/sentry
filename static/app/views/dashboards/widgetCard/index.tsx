import {Component, Fragment} from 'react';
import LazyLoad from 'react-lazyload';
import {WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import Placeholder from 'sentry/components/placeholder';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCopy, IconDelete, IconEdit, IconGrabbable, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getFormattedDate} from 'sentry/utils/dates';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {AggregationOutputType, parseFunction} from 'sentry/utils/discover/fields';
import {ExtractedMetricsTag} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {
  MEPConsumer,
  MEPState,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import {DRAG_HANDLE_CLASS} from '../dashboard';
import {DashboardFilters, DisplayType, Widget, WidgetType} from '../types';
import {getColoredWidgetIndicator, hasThresholdMaxValue} from '../utils';
import {DEFAULT_RESULTS_LIMIT} from '../widgetBuilder/utils';

import {DashboardsMEPConsumer, DashboardsMEPProvider} from './dashboardsMEPContext';
import WidgetCardChartContainer from './widgetCardChartContainer';
import WidgetCardContextMenu from './widgetCardContextMenu';

const SESSION_DURATION_INGESTION_STOP_DATE = new Date('2023-01-12');
export const SESSION_DURATION_ALERT = (
  <PanelAlert type="warning">
    {t(
      'session.duration is no longer being recorded as of %s. Data in this widget may be incomplete.',
      getFormattedDate(SESSION_DURATION_INGESTION_STOP_DATE, 'MMM D, YYYY')
    )}
  </PanelAlert>
);

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = WithRouterProps & {
  api: Client;
  isEditing: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLimitReached: boolean;
  dashboardFilters?: DashboardFilters;
  draggableProps?: DraggableProps;
  hideToolbar?: boolean;
  index?: string;
  isMobile?: boolean;
  isPreview?: boolean;
  isWidgetInvalid?: boolean;
  noDashboardsMEPProvider?: boolean;
  noLazyLoad?: boolean;
  onDataFetched?: (results: TableDataWithTitle[]) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showContextMenu?: boolean;
  showStoredAlert?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

type State = {
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: Record<string, AggregationOutputType>;
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
};

type SearchFilterKey = {key?: {value: string}};

const ERROR_FIELDS = [
  'error.handled',
  'error.unhandled',
  'error.mechanism',
  'error.type',
  'error.value',
];

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
              size="xs"
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
            size="xs"
            borderless
            onClick={onEdit}
            icon={<IconEdit />}
          />
          <Button
            aria-label={t('Duplicate Widget')}
            size="xs"
            borderless
            onClick={onDuplicate}
            icon={<IconCopy />}
          />
          <Button
            data-test-id="widget-delete"
            aria-label={t('Delete Widget')}
            borderless
            size="xs"
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
      router,
      location,
      index,
    } = this.props;

    const {seriesData, tableData, pageLinks, totalIssuesCount, seriesResultsType} =
      this.state;

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
        router={router}
        location={location}
        index={index}
        seriesData={seriesData}
        seriesResultsType={seriesResultsType}
        tableData={tableData}
        pageLinks={pageLinks}
        totalIssuesCount={totalIssuesCount}
      />
    );
  }

  setData = ({
    tableResults,
    timeseriesResults,
    totalIssuesCount,
    pageLinks,
    timeseriesResultsTypes,
  }: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    timeseriesResultsTypes?: Record<string, AggregationOutputType>;
    totalIssuesCount?: string;
  }) => {
    const {onDataFetched} = this.props;

    if (onDataFetched && tableResults) {
      onDataFetched(tableResults);
    }

    this.setState({
      seriesData: timeseriesResults,
      tableData: tableResults,
      totalIssuesCount,
      pageLinks,
      seriesResultsType: timeseriesResultsTypes,
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
      noDashboardsMEPProvider,
      dashboardFilters,
      isWidgetInvalid,
      location,
    } = this.props;

    if (widget.displayType === DisplayType.TOP_N) {
      const queries = widget.queries.map(query => ({
        ...query,
        // Use the last aggregate because that's where the y-axis is stored
        aggregates: query.aggregates.length
          ? [query.aggregates[query.aggregates.length - 1]]
          : [],
      }));
      widget.queries = queries;
      widget.limit = DEFAULT_RESULTS_LIMIT;
    }

    const hasSessionDuration = widget.queries.some(query =>
      query.aggregates.some(aggregate => aggregate.includes('session.duration'))
    );

    function conditionalWrapWithDashboardsMEPProvider(component: React.ReactNode) {
      if (noDashboardsMEPProvider) {
        return component;
      }
      return <DashboardsMEPProvider>{component}</DashboardsMEPProvider>;
    }
    const widgetContainsErrorFields = widget.queries.some(
      ({columns, aggregates, conditions}) =>
        ERROR_FIELDS.some(
          errorField =>
            columns.includes(errorField) ||
            aggregates.some(
              aggregate => parseFunction(aggregate)?.arguments.includes(errorField)
            ) ||
            parseSearch(conditions)?.some(
              filter => (filter as SearchFilterKey).key?.value === errorField
            )
        )
    );

    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        {conditionalWrapWithDashboardsMEPProvider(
          <Fragment>
            <VisuallyCompleteWithData
              id="DashboardList-FirstWidgetCard"
              hasData={
                ((this.state.tableData?.length || this.state.seriesData?.length) ?? 0) > 0
              }
              disabled={Number(this.props.index) !== 0}
            >
              <WidgetCardPanel isDragging={false}>
                <WidgetHeader>
                  <WidgetHeaderDescription>
                    <WidgetTitleRow>
                      <Tooltip
                        title={widget.title}
                        containerDisplayMode="grid"
                        showOnlyOnOverflow
                      >
                        <WidgetTitle>{widget.title}</WidgetTitle>
                      </Tooltip>
                      {widget.thresholds &&
                        hasThresholdMaxValue(widget.thresholds) &&
                        this.state.tableData &&
                        organization.features.includes('dashboard-widget-indicators') &&
                        getColoredWidgetIndicator(
                          widget.thresholds,
                          this.state.tableData
                        )}
                      <ExtractedMetricsTag queryKey={widget} />
                    </WidgetTitleRow>
                    {widget.description && (
                      <Tooltip
                        title={widget.description}
                        containerDisplayMode="grid"
                        showOnlyOnOverflow
                        isHoverable
                      >
                        <WidgetDescription>{widget.description}</WidgetDescription>
                      </Tooltip>
                    )}
                    <DashboardsMEPConsumer>
                      {({}) => {
                        // TODO(Tele-Team): Re-enable this when we have a better way to determine if the data is transaction only
                        // if (
                        //   isMetricsData === false &&
                        //   widget.widgetType === WidgetType.DISCOVER
                        // ) {
                        //   return (
                        //     <Tooltip
                        //       containerDisplayMode="inline-flex"
                        //       title={t(
                        //         'Based on your search criteria, the sampled events available may be limited and may not be representative of all events.'
                        //       )}
                        //     >
                        //       <IconWarning color="warningText" />
                        //     </Tooltip>
                        //   );
                        // }
                        return null;
                      }}
                    </DashboardsMEPConsumer>
                  </WidgetHeaderDescription>
                  {this.renderContextMenu()}
                </WidgetHeader>
                {hasSessionDuration && SESSION_DURATION_ALERT}

                {isWidgetInvalid ? (
                  <Fragment>
                    {renderErrorMessage?.('Widget query condition is invalid.')}
                    <StyledErrorPanel>
                      <IconWarning color="gray500" size="lg" />
                    </StyledErrorPanel>
                  </Fragment>
                ) : noLazyLoad ? (
                  <WidgetCardChartContainer
                    location={location}
                    api={api}
                    organization={organization}
                    selection={selection}
                    widget={widget}
                    isMobile={isMobile}
                    renderErrorMessage={renderErrorMessage}
                    tableItemLimit={tableItemLimit}
                    windowWidth={windowWidth}
                    onDataFetched={this.setData}
                    dashboardFilters={dashboardFilters}
                  />
                ) : (
                  <LazyLoad once resize height={200}>
                    <WidgetCardChartContainer
                      location={location}
                      api={api}
                      organization={organization}
                      selection={selection}
                      widget={widget}
                      isMobile={isMobile}
                      renderErrorMessage={renderErrorMessage}
                      tableItemLimit={tableItemLimit}
                      windowWidth={windowWidth}
                      onDataFetched={this.setData}
                      dashboardFilters={dashboardFilters}
                    />
                  </LazyLoad>
                )}
                {this.renderToolbar()}
              </WidgetCardPanel>
            </VisuallyCompleteWithData>
            {!organization.features.includes('performance-mep-bannerless-ui') && (
              <MEPConsumer>
                {metricSettingContext => {
                  return (
                    <DashboardsMEPConsumer>
                      {({isMetricsData}) => {
                        if (
                          showStoredAlert &&
                          isMetricsData === false &&
                          widget.widgetType === WidgetType.DISCOVER &&
                          metricSettingContext &&
                          metricSettingContext.metricSettingState !==
                            MEPState.TRANSACTIONS_ONLY
                        ) {
                          if (!widgetContainsErrorFields) {
                            return (
                              <StoredDataAlert showIcon>
                                {tct(
                                  "Your selection is only applicable to [indexedData: indexed event data]. We've automatically adjusted your results.",
                                  {
                                    indexedData: (
                                      <ExternalLink href="https://docs.sentry.io/product/dashboards/widget-builder/#errors--transactions" />
                                    ),
                                  }
                                )}
                              </StoredDataAlert>
                            );
                          }
                        }
                        return null;
                      }}
                    </DashboardsMEPConsumer>
                  );
                }}
              </MEPConsumer>
            )}
          </Fragment>
        )}
      </ErrorBoundary>
    );
  }
}

export default withApi(withOrganization(withPageFilters(withSentryRouter(WidgetCard))));

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
  border-radius: calc(${p => p.theme.panelBorderRadius} - 1px);
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
  ${p => p.theme.overflowEllipsis};
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

const StyledErrorPanel = styled(ErrorPanel)`
  padding: ${space(2)};
`;

const WidgetHeaderDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const WidgetTitleRow = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

export const WidgetDescription = styled('small')`
  ${p => p.theme.overflowEllipsis}
  color: ${p => p.theme.gray300};
`;
