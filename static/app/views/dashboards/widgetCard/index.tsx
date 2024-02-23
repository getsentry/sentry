import {Component, Fragment} from 'react';
import LazyLoad from 'react-lazyload';
import type {WithRouterProps} from 'react-router';
import type {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import Placeholder from 'sentry/components/placeholder';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {getFormattedDate} from 'sentry/utils/dates';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {parseFunction} from 'sentry/utils/discover/fields';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {ExtractedMetricsTag} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {
  MEPConsumer,
  MEPState,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import useOrganization from 'sentry/utils/useOrganization';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {DASHBOARD_CHART_GROUP} from 'sentry/views/dashboards/dashboard';
import {MetricWidgetCard} from 'sentry/views/dashboards/metrics/widgetCard';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';

import type {DashboardFilters, Widget} from '../types';
import {DisplayType, OnDemandExtractionState, WidgetType} from '../types';
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
  isEditingDashboard: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLimitReached: boolean;
  dashboardFilters?: DashboardFilters;
  draggableProps?: DraggableProps;
  hideToolbar?: boolean;
  index?: string;
  isEditingWidget?: boolean;
  isMobile?: boolean;
  isPreview?: boolean;
  isWidgetInvalid?: boolean;
  noDashboardsMEPProvider?: boolean;
  noLazyLoad?: boolean;
  onDataFetched?: (results: TableDataWithTitle[]) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onUpdate?: (widget: Widget | null) => void;
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
      isEditingDashboard,
      isMobile,
    } = this.props;

    if (!isEditingDashboard) {
      return null;
    }

    return (
      <Toolbar
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        draggableProps={draggableProps}
        hideToolbar={hideToolbar}
        isMobile={isMobile}
      />
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
      isEditingDashboard,
      router,
      location,
      index,
    } = this.props;

    const {seriesData, tableData, pageLinks, totalIssuesCount, seriesResultsType} =
      this.state;

    if (isEditingDashboard) {
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
    // prettier-ignore
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

    if (widget.widgetType === WidgetType.METRICS) {
      if (hasDDMFeature(organization)) {
        return (
          <MetricWidgetCard
            index={this.props.index}
            isEditingDashboard={this.props.isEditingDashboard}
            onEdit={this.props.onEdit}
            onDelete={this.props.onDelete}
            onDuplicate={this.props.onDuplicate}
            router={this.props.router}
            location={this.props.location}
            organization={organization}
            selection={selection}
            widget={widget}
            dashboardFilters={dashboardFilters}
            renderErrorMessage={renderErrorMessage}
            showContextMenu={this.props.showContextMenu}
          />
        );
      }
    }

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
                <WidgetHeaderWrapper>
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
                      <DisplayOnDemandWarnings widget={widget} />
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
                  </WidgetHeaderDescription>
                  {this.renderContextMenu()}
                </WidgetHeaderWrapper>
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
                    chartGroup={DASHBOARD_CHART_GROUP}
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
                      chartGroup={DASHBOARD_CHART_GROUP}
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

function DisplayOnDemandWarnings(props: {widget: Widget}) {
  const organization = useOrganization();
  if (!hasOnDemandMetricWidgetFeature(organization)) {
    return null;
  }
  // prettier-ignore
  const widgetContainsHighCardinality = props.widget.queries.some(
    wq =>
      wq.onDemand?.some(
        d => d.extractionState === OnDemandExtractionState.DISABLED_HIGH_CARDINALITY
      )
  );
  // prettier-ignore
  const widgetReachedSpecLimit = props.widget.queries.some(
    wq =>
      wq.onDemand?.some(
        d => d.extractionState === OnDemandExtractionState.DISABLED_SPEC_LIMIT
      )
  );

  if (widgetContainsHighCardinality) {
    return (
      <Tooltip
        containerDisplayMode="inline-flex"
        title={t(
          'This widget is using indexed data because it has a column with too many unique values.'
        )}
      >
        <IconWarning color="warningText" />
      </Tooltip>
    );
  }
  if (widgetReachedSpecLimit) {
    return (
      <Tooltip
        containerDisplayMode="inline-flex"
        title={t(
          "This widget is using indexed data because you've reached your organization limit for dynamically extracted metrics."
        )}
      >
        <IconWarning color="warningText" />
      </Tooltip>
    );
  }

  return null;
}

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

const StoredDataAlert = styled(Alert)`
  margin-top: ${space(1)};
  margin-bottom: 0;
`;

const StyledErrorPanel = styled(ErrorPanel)`
  padding: ${space(2)};
`;

export const WidgetTitleRow = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

export const WidgetDescription = styled('small')`
  ${p => p.theme.overflowEllipsis}
  color: ${p => p.theme.gray300};
`;

const WidgetTitle = styled(HeaderTitle)`
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

const WidgetHeaderWrapper = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const WidgetHeaderDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;
