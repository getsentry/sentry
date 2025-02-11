import {useContext, useState} from 'react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import type {BadgeProps} from 'sentry/components/badge/badge';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {isWidgetViewerPath} from 'sentry/components/modals/widgetViewerModal/utils';
import PanelAlert from 'sentry/components/panels/panelAlert';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Confidence, Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {statsPeriodToDays} from 'sentry/utils/duration/statsPeriodToDays';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {useExtractionStatus} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {DASHBOARD_CHART_GROUP} from 'sentry/views/dashboards/dashboard';
import {useDiscoverSplitAlert} from 'sentry/views/dashboards/discoverSplitAlert';
import WidgetCardChartContainer from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';

import type {DashboardFilters, Widget} from '../types';
import {DisplayType, OnDemandExtractionState, WidgetType} from '../types';
import {DEFAULT_RESULTS_LIMIT} from '../widgetBuilder/utils';
import type WidgetLegendSelectionState from '../widgetLegendSelectionState';
import {BigNumberWidget} from '../widgets/bigNumberWidget/bigNumberWidget';
import type {Meta} from '../widgets/common/types';
import {WidgetFrame} from '../widgets/common/widgetFrame';
import {WidgetViewerContext} from '../widgetViewer/widgetViewerContext';

import {useDashboardsMEPContext} from './dashboardsMEPContext';
import {getMenuOptions, useIndexedEventsWarning} from './widgetCardContextMenu';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

const SESSION_DURATION_INGESTION_STOP_DATE = new Date('2023-01-12');

export const SESSION_DURATION_ALERT_TEXT = t(
  'session.duration is no longer being recorded as of %s. Data in this widget may be incomplete.',
  getFormattedDate(SESSION_DURATION_INGESTION_STOP_DATE, 'MMM D, YYYY')
);

export const SESSION_DURATION_ALERT = (
  <PanelAlert type="warning">{SESSION_DURATION_ALERT_TEXT}</PanelAlert>
);

type Props = WithRouterProps & {
  api: Client;
  isEditingDashboard: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  widgetLimitReached: boolean;
  borderless?: boolean;
  dashboardFilters?: DashboardFilters;
  disableFullscreen?: boolean;
  forceDescriptionTooltip?: boolean;
  hasEditAccess?: boolean;
  index?: string;
  isEditingWidget?: boolean;
  isMobile?: boolean;
  isPreview?: boolean;
  isWidgetInvalid?: boolean;
  legendOptions?: LegendComponentOption;
  minTableColumnWidth?: string;
  onDataFetched?: (results: TableDataWithTitle[]) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onLegendSelectChanged?: () => void;
  onSetTransactionsDataset?: () => void;
  onUpdate?: (widget: Widget | null) => void;
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  shouldResize?: boolean;
  showConfidenceWarning?: boolean;
  showContextMenu?: boolean;
  showStoredAlert?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

type Data = {
  confidence?: Confidence;
  pageLinks?: string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  totalIssuesCount?: string;
};

function WidgetCard(props: Props) {
  const [data, setData] = useState<Data>();
  const {setData: setWidgetViewerData} = useContext(WidgetViewerContext);

  const onDataFetched = (newData: Data) => {
    if (props.onDataFetched && newData.tableResults) {
      props.onDataFetched(newData.tableResults);
    }

    setData(prevData => ({...prevData, ...newData}));
  };

  const {
    api,
    organization,
    selection,
    widget,
    isMobile,
    renderErrorMessage,
    tableItemLimit,
    windowWidth,
    dashboardFilters,
    isWidgetInvalid,
    location,
    onWidgetSplitDecision,
    shouldResize,
    onLegendSelectChanged,
    onSetTransactionsDataset,
    legendOptions,
    widgetLegendState,
    disableFullscreen,
    showConfidenceWarning,
    minTableColumnWidth,
  } = props;

  if (widget.displayType === DisplayType.TOP_N) {
    const queries = widget.queries.map(query => ({
      ...query,
      // Use the last aggregate because that's where the y-axis is stored
      aggregates: query.aggregates.length
        ? [query.aggregates[query.aggregates.length - 1]!]
        : [],
    }));
    widget.queries = queries;
    widget.limit = DEFAULT_RESULTS_LIMIT;
  }

  const hasSessionDuration = widget.queries.some(query =>
    query.aggregates.some(aggregate => aggregate.includes('session.duration'))
  );

  const {isMetricsData} = useDashboardsMEPContext();
  const extractionStatus = useExtractionStatus({queryKey: widget});
  const indexedEventsWarning = useIndexedEventsWarning();
  const onDemandWarning = useOnDemandWarning({widget});
  const discoverSplitAlert = useDiscoverSplitAlert({widget, onSetTransactionsDataset});
  const sessionDurationWarning = hasSessionDuration ? SESSION_DURATION_ALERT_TEXT : null;
  const spanTimeRangeWarning = useTimeRangeWarning({widget});

  const onFullScreenViewClick = () => {
    if (!isWidgetViewerPath(location.pathname)) {
      setWidgetViewerData({
        pageLinks: data?.pageLinks,
        seriesData: data?.timeseriesResults,
        tableData: data?.tableResults,
        seriesResultsType: data?.timeseriesResultsTypes,
        totalIssuesCount: data?.totalIssuesCount,
        confidence: data?.confidence,
      });

      props.router.push({
        pathname: `${location.pathname}${
          location.pathname.endsWith('/') ? '' : '/'
        }widget/${props.index}/`,
        query: location.query,
      });
    }
  };

  const onDemandExtractionBadge: BadgeProps | undefined =
    extractionStatus === 'extracted'
      ? {
          text: t('Extracted'),
        }
      : extractionStatus === 'not-extracted'
        ? {
            text: t('Not Extracted'),
          }
        : undefined;

  const indexedDataBadge: BadgeProps | undefined = indexedEventsWarning
    ? {
        text: t('Indexed'),
      }
    : undefined;

  const badges = [indexedDataBadge, onDemandExtractionBadge].filter(
    Boolean
  ) as BadgeProps[];

  const warnings = [
    onDemandWarning,
    discoverSplitAlert,
    sessionDurationWarning,
    spanTimeRangeWarning,
  ].filter(Boolean) as string[];

  const actionsDisabled = Boolean(props.isPreview);
  const actionsMessage = actionsDisabled
    ? t('This is a preview only. To edit, you must add this dashboard.')
    : undefined;

  const actions = props.showContextMenu
    ? getMenuOptions(
        organization,
        selection,
        widget,
        Boolean(isMetricsData),
        props.widgetLimitReached,
        props.hasEditAccess,
        props.onDelete,
        props.onDuplicate,
        props.onEdit
      )
    : [];

  const widgetQueryError = isWidgetInvalid
    ? t('Widget query condition is invalid.')
    : undefined;

  return (
    <ErrorBoundary
      customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
    >
      <VisuallyCompleteWithData
        id="DashboardList-FirstWidgetCard"
        hasData={
          ((data?.tableResults?.length || data?.timeseriesResults?.length) ?? 0) > 0
        }
        disabled={Number(props.index) !== 0}
      >
        {widget.displayType === DisplayType.BIG_NUMBER ? (
          <WidgetCardDataLoader
            widget={widget}
            selection={selection}
            dashboardFilters={dashboardFilters}
            onDataFetched={onDataFetched}
            onWidgetSplitDecision={onWidgetSplitDecision}
            tableItemLimit={tableItemLimit}
          >
            {({loading, errorMessage, tableResults}) => {
              // Big Number widgets only support one query, so we take the first query's results and meta
              const tableData = tableResults?.[0]?.data;
              const tableMeta = tableResults?.[0]?.meta as Meta | undefined;
              const fields = Object.keys(tableMeta?.fields ?? {});

              let field = fields[0]!;
              let selectedField = field;

              if (defined(widget.queries[0]!.selectedAggregate)) {
                const index = widget.queries[0]!.selectedAggregate;
                selectedField = widget.queries[0]!.aggregates[index]!;
                if (fields.includes(selectedField)) {
                  field = selectedField;
                }
              }

              const value = tableData?.[0]?.[selectedField];

              return (
                <BigNumberWidget
                  title={widget.title}
                  description={widget.description}
                  badgeProps={badges}
                  warnings={warnings}
                  actionsDisabled={actionsDisabled}
                  actionsMessage={actionsMessage}
                  actions={actions}
                  onFullScreenViewClick={
                    disableFullscreen ? undefined : onFullScreenViewClick
                  }
                  isLoading={loading}
                  thresholds={widget.thresholds ?? undefined}
                  value={value}
                  field={field}
                  meta={tableMeta}
                  error={widgetQueryError || errorMessage || undefined}
                  preferredPolarity="-"
                  borderless={props.borderless}
                  revealTooltip={props.forceDescriptionTooltip ? 'always' : undefined}
                />
              );
            }}
          </WidgetCardDataLoader>
        ) : (
          <WidgetFrame
            title={widget.title}
            description={widget.description}
            badgeProps={badges}
            warnings={warnings}
            actionsDisabled={actionsDisabled}
            error={widgetQueryError}
            actionsMessage={actionsMessage}
            actions={actions}
            onFullScreenViewClick={disableFullscreen ? undefined : onFullScreenViewClick}
            borderless={props.borderless}
            revealTooltip={props.forceDescriptionTooltip ? 'always' : undefined}
            noVisualizationPadding
          >
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
              onDataFetched={onDataFetched}
              dashboardFilters={dashboardFilters}
              chartGroup={DASHBOARD_CHART_GROUP}
              onWidgetSplitDecision={onWidgetSplitDecision}
              shouldResize={shouldResize}
              onLegendSelectChanged={onLegendSelectChanged}
              legendOptions={legendOptions}
              widgetLegendState={widgetLegendState}
              showConfidenceWarning={showConfidenceWarning}
              minTableColumnWidth={minTableColumnWidth}
            />
          </WidgetFrame>
        )}
      </VisuallyCompleteWithData>
    </ErrorBoundary>
  );
}

export default withApi(withOrganization(withPageFilters(withSentryRouter(WidgetCard))));

function useOnDemandWarning(props: {widget: Widget}): string | null {
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
    return t(
      'This widget is using indexed data because it has a column with too many unique values.'
    );
  }

  if (widgetReachedSpecLimit) {
    return t(
      "This widget is using indexed data because you've reached your organization limit for dynamically extracted metrics."
    );
  }

  return null;
}

function useTimeRangeWarning(props: {widget: Widget}) {
  const {
    selection: {datetime},
  } = usePageFilters();

  if (props.widget.widgetType !== WidgetType.SPANS) {
    return null;
  }

  if (statsPeriodToDays(datetime.period, datetime.start, datetime.end) > 30) {
    // This message applies if the user has selected a time range >30d because we truncate the
    // snuba response to 30 days to reduce load on the system.
    return t(
      "Spans-based widgets have been truncated to 30 days of data. We're working on ramping this up."
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

export const WidgetTitleRow = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

export const WidgetDescription = styled('small')`
  ${p => p.theme.overflowEllipsis}
  color: ${p => p.theme.gray300};
`;
