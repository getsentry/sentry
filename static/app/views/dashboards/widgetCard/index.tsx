import {useContext, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import {DateTime} from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {isWidgetViewerPath} from 'sentry/components/modals/widgetViewerModal/utils';
import PanelAlert from 'sentry/components/panels/panelAlert';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Confidence, Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {statsPeriodToDays} from 'sentry/utils/duration/statsPeriodToDays';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {useExtractionStatus} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {DASHBOARD_CHART_GROUP} from 'sentry/views/dashboards/dashboard';
import {useDiscoverSplitAlert} from 'sentry/views/dashboards/discoverSplitAlert';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {
  DisplayType,
  OnDemandExtractionState,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {DEFAULT_RESULTS_LIMIT} from 'sentry/views/dashboards/widgetBuilder/utils';
import {WidgetCardChartContainer} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';
import type WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import {WidgetViewerContext} from 'sentry/views/dashboards/widgetViewer/widgetViewerContext';

import {useDashboardsMEPContext} from './dashboardsMEPContext';
import {getMenuOptions, useIndexedEventsWarning} from './widgetCardContextMenu';
import {WidgetFrame} from './widgetFrame';

const SESSION_DURATION_INGESTION_STOP_DATE = new Date('2023-01-12');

const SESSION_DURATION_ALERT_TEXT = tct(
  'session.duration is no longer being recorded as of [date]. Data in this widget may be incomplete.',
  {
    date: <DateTime dateOnly year date={SESSION_DURATION_INGESTION_STOP_DATE} />,
  }
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
  disableZoom?: boolean;
  forceDescriptionTooltip?: boolean;
  hasEditAccess?: boolean;
  index?: string;
  isEditingWidget?: boolean;
  isMobile?: boolean;
  isPreview?: boolean;
  isWidgetInvalid?: boolean;
  legendOptions?: LegendComponentOption;
  minTableColumnWidth?: number;
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
  showLoadingText?: boolean;
  showStoredAlert?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

type Data = {
  confidence?: Confidence;
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  totalIssuesCount?: string;
};

function WidgetCard(props: Props) {
  const [data, setData] = useState<Data>();
  const [isLoadingTextVisible, setIsLoadingTextVisible] = useState(false);
  const {setData: setWidgetViewerData} = useContext(WidgetViewerContext);
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onDataFetched = (newData: Data) => {
    const {...rest} = newData;
    if (props.onDataFetched && rest.tableResults) {
      props.onDataFetched(rest.tableResults);
    }

    setData(prevData => ({...prevData, ...rest}));

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLoadingTextVisible(false);
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
    disableZoom,
    showLoadingText,
    router,
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

  const onDataFetchStart = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsLoadingTextVisible(false);
    timeoutRef.current = setTimeout(() => {
      setIsLoadingTextVisible(true);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [timeoutRef]);

  const onFullScreenViewClick = () => {
    if (!isWidgetViewerPath(location.pathname)) {
      setWidgetViewerData({
        pageLinks: data?.pageLinks,
        seriesData: data?.timeseriesResults,
        tableData: data?.tableResults,
        seriesResultsType: data?.timeseriesResultsTypes,
        totalIssuesCount: data?.totalIssuesCount,
        confidence: data?.confidence,
        sampleCount: data?.sampleCount,
        isSampled: data?.isSampled,
      });

      navigate(
        {
          pathname: `${location.pathname}${
            location.pathname.endsWith('/') ? '' : '/'
          }widget/${props.index}/`,
          query: location.query,
        },
        {preventScrollReset: true}
      );
    }
  };

  const onDemandExtractionBadge: string | undefined =
    extractionStatus === 'extracted'
      ? t('Extracted')
      : extractionStatus === 'not-extracted'
        ? t('Not Extracted')
        : undefined;

  const indexedDataBadge: string | undefined = indexedEventsWarning
    ? t('Indexed')
    : undefined;

  const badges = [indexedDataBadge, onDemandExtractionBadge].filter(n => n !== undefined);

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
        dashboardFilters,
        organization,
        selection,
        widget,
        Boolean(isMetricsData),
        props.widgetLimitReached,
        props.hasEditAccess,
        location,
        router,
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
      customComponent={() => <ErrorCard>{t('Error loading widget data')}</ErrorCard>}
    >
      <VisuallyCompleteWithData
        id="DashboardList-FirstWidgetCard"
        hasData={
          ((data?.tableResults?.length || data?.timeseriesResults?.length) ?? 0) > 0
        }
        disabled={Number(props.index) !== 0}
      >
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
            disableZoom={disableZoom}
            onDataFetchStart={onDataFetchStart}
            showLoadingText={showLoadingText && isLoadingTextVisible}
          />
        </WidgetFrame>
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

export const WidgetDescription = styled('small')`
  ${p => p.theme.overflowEllipsis}
  color: ${p => p.theme.subText};
`;
