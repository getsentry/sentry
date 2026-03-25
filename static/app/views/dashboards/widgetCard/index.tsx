import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {openWidgetViewerModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {DateTime} from 'sentry/components/dateTime';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  isWidgetViewerPath,
  WidgetViewerQueryField,
} from 'sentry/components/modals/widgetViewerModal/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {t, tct} from 'sentry/locale';
import {HookStore} from 'sentry/stores/hookStore';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Confidence, Organization} from 'sentry/types/organization';
import {CAN_MARK} from 'sentry/utils/analytics';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit, Sort} from 'sentry/utils/discover/fields';
import {statsPeriodToDays} from 'sentry/utils/duration/statsPeriodToDays';
import {getFieldDefinition} from 'sentry/utils/fields';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {useExtractionStatus} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {withApi} from 'sentry/utils/withApi';
import {withOrganization} from 'sentry/utils/withOrganization';
import {withPageFilters} from 'sentry/utils/withPageFilters';
// eslint-disable-next-line no-restricted-imports
import {withSentryRouter} from 'sentry/utils/withSentryRouter';
import {DASHBOARD_CHART_GROUP} from 'sentry/views/dashboards/dashboard';
import type {DashboardFilters, Widget as TWidget} from 'sentry/views/dashboards/types';
import {
  DashboardFilterKeys,
  DisplayType,
  OnDemandExtractionState,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {widgetCanUseTimeSeriesVisualization} from 'sentry/views/dashboards/utils/widgetCanUseTimeSeriesVisualization';
import {WidgetCardChartContainer} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';
import type {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

import {VisualizationWidget} from './visualizationWidget';
import {
  getMenuOptions,
  useDroppedColumnsWarning,
  useTransactionsDeprecationWarning,
} from './widgetCardContextMenu';
import {WidgetFrame} from './widgetFrame';

export type OnDataFetchedParams = {
  tableResults?: TableDataWithTitle[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
};

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

const SESSION_DURATION_INGESTION_STOP_DATE = new Date('2023-01-12');

const SESSION_DURATION_ALERT_TEXT = tct(
  'session.duration is no longer being recorded as of [date]. Data in this widget may be incomplete.',
  {
    date: <DateTime dateOnly year date={SESSION_DURATION_INGESTION_STOP_DATE} />,
  }
);

export const SESSION_DURATION_ALERT = (
  <PanelAlert variant="warning">{SESSION_DURATION_ALERT_TEXT}</PanelAlert>
);

type Props = WithRouterProps & {
  api: Client;
  isEditingDashboard: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: TWidget;
  widgetLegendState: WidgetLegendSelectionState;
  widgetLimitReached: boolean;
  borderless?: boolean;
  dashboardFilters?: DashboardFilters;
  disableFullscreen?: boolean;
  disableTableActions?: boolean;
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
  onDataFetched?: (results: OnDataFetchedParams) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onLegendSelectChanged?: () => void;
  onSetTransactionsDataset?: () => void;
  onUpdate?: (widget: TWidget | null) => void;
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
  onWidgetTableResizeColumn?: (columns: TabularColumn[]) => void;
  onWidgetTableSort?: (sort: Sort) => void;
  shouldResize?: boolean;
  showConfidenceWarning?: boolean;
  showContextMenu?: boolean;
  showLoadingText?: boolean;
  showStoredAlert?: boolean;
  tableItemLimit?: number;
  widgetInterval?: string;
  windowWidth?: number;
};

type Data = {
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
  totalIssuesCount?: string;
};

function WidgetCard(props: Props) {
  const [data, setData] = useState<Data>();
  const [isLoadingTextVisible, setIsLoadingTextVisible] = useState(false);
  const navigate = useNavigate();
  const {dashboardId: currentDashboardId} = useParams<{dashboardId: string}>();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onDataFetched = (newData: Data) => {
    if (props.onDataFetched) {
      props.onDataFetched({
        tableResults: newData.tableResults,
        timeseriesResultsTypes: newData.timeseriesResultsTypes,
        timeseriesResultsUnits: newData.timeseriesResultsUnits,
      });
    }

    setData(prevData => ({...prevData, ...newData}));

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
    tableItemLimit,
    windowWidth,
    dashboardFilters,
    isWidgetInvalid,
    location,
    onWidgetSplitDecision,
    shouldResize,
    onLegendSelectChanged,
    legendOptions,
    widgetLegendState,
    disableFullscreen,
    showConfidenceWarning,
    minTableColumnWidth,
    disableZoom,
    showLoadingText,
    onWidgetTableSort,
    onWidgetTableResizeColumn,
    disableTableActions,
    widgetInterval,
  } = props;

  if (widget.displayType === DisplayType.TOP_N) {
    widget.displayType = DisplayType.AREA;
  }

  const hasSessionDuration = widget.queries.some(query =>
    query.aggregates.some(aggregate => aggregate.includes('session.duration'))
  );

  const extractionStatus = useExtractionStatus({queryKey: widget});
  const onDemandWarning = useOnDemandWarning({widget});
  const transactionsDeprecationWarning = useTransactionsDeprecationWarning({
    widget,
    selection,
  });
  const droppedColumnsWarning = useDroppedColumnsWarning(widget);
  const sessionDurationWarning = hasSessionDuration ? SESSION_DURATION_ALERT_TEXT : null;
  const spanTimeRangeWarning = useTimeRangeWarning({widget});
  const conflictingFilterWarning = useConflictingFilterWarning({
    widget,
    dashboardFilters,
  });

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
    if (isWidgetViewerPath(location.pathname)) {
      return;
    }
    if (currentDashboardId) {
      if (CAN_MARK) {
        performance.mark('dashboard.widget.fullScreenViewClick');
      }
      navigate(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboard/${currentDashboardId}/widget/${props.index}/`,
          query: {
            ...location.query,
            sort:
              widget.displayType === DisplayType.TABLE
                ? widget.queries[0]?.orderby
                : location.query.sort,
          },
        }),
        {preventScrollReset: true}
      );
    } else {
      openWidgetViewerModal({
        organization,
        widget,
        widgetLegendState,
        dashboardFilters,
        widgetInterval,
        onClose: () => {
          // Filter out Widget Viewer Modal query params when exiting the Modal
          const query = omit(location.query, Object.values(WidgetViewerQueryField));
          navigate(
            {pathname: location.pathname, query},
            {preventScrollReset: true, replace: true}
          );
        },
      });
    }
  };

  const onDemandExtractionBadge =
    extractionStatus === 'extracted'
      ? t('Extracted')
      : extractionStatus === 'not-extracted'
        ? t('Not Extracted')
        : undefined;

  const badges = [onDemandExtractionBadge].filter(n => n !== undefined);

  const warnings = [
    onDemandWarning,
    sessionDurationWarning,
    spanTimeRangeWarning,
    transactionsDeprecationWarning,
    droppedColumnsWarning,
    conflictingFilterWarning,
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
        props.widgetLimitReached,
        props.hasEditAccess,
        location,
        props.onDelete,
        props.onDuplicate,
        props.onEdit,
        data?.timeseriesResults
      )
    : [];

  const widgetQueryError = isWidgetInvalid
    ? t('Widget query condition is invalid.')
    : undefined;

  const errorBoundaryHandler = () => {
    return (
      <Widget
        Title={<Widget.WidgetTitle title={widget.title} />}
        Visualization={
          <Widget.WidgetError
            error={t("Something went wrong with this widget, we're looking into it!")}
          />
        }
        noVisualizationPadding
      />
    );
  };

  const canUseTimeseriesVisualization = widgetCanUseTimeSeriesVisualization(widget);
  if (canUseTimeseriesVisualization) {
    return (
      <ErrorBoundary customComponent={errorBoundaryHandler}>
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
            noVisualizationPadding={canUseTimeseriesVisualization}
            onFullScreenViewClick={disableFullscreen ? undefined : onFullScreenViewClick}
            borderless={props.borderless}
            revealTooltip={props.forceDescriptionTooltip ? 'always' : undefined}
          >
            <VisualizationWidget
              widget={widget}
              selection={selection}
              dashboardFilters={dashboardFilters}
              onDataFetched={onDataFetched}
              onWidgetTableSort={onWidgetTableSort}
              onWidgetTableResizeColumn={onWidgetTableResizeColumn}
              onDataFetchStart={onDataFetchStart}
              tableItemLimit={tableItemLimit}
              widgetInterval={widgetInterval}
              showConfidenceWarning={showConfidenceWarning}
            />
          </WidgetFrame>
        </VisuallyCompleteWithData>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary customComponent={errorBoundaryHandler}>
      <VisuallyCompleteWithData
        id="DashboardList-FirstWidgetCard"
        hasData={
          ((data?.tableResults?.length || data?.timeseriesResults?.length) ?? 0) > 0
        }
        disabled={Number(props.index) !== 0}
      >
        <WidgetFrame
          title={widget.title}
          description={
            widget.displayType === DisplayType.TEXT ? undefined : widget.description
          }
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
            api={api}
            selection={selection}
            widget={widget}
            isMobile={isMobile}
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
            onWidgetTableSort={onWidgetTableSort}
            onWidgetTableResizeColumn={onWidgetTableResizeColumn}
            disableTableActions={disableTableActions}
          />
        </WidgetFrame>
      </VisuallyCompleteWithData>
    </ErrorBoundary>
  );
}

export default withApi(withOrganization(withPageFilters(withSentryRouter(WidgetCard))));

function useOnDemandWarning(props: {widget: TWidget}): string | null {
  const organization = useOrganization();

  if (!hasOnDemandMetricWidgetFeature(organization)) {
    return null;
  }
  // oxfmt-ignore
  const widgetContainsHighCardinality = props.widget.queries.some(
    wq =>
      wq.onDemand?.some(
        d => d.extractionState === OnDemandExtractionState.DISABLED_HIGH_CARDINALITY
      )
  );
  // oxfmt-ignore
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

function useTimeRangeWarning({widget}: {widget: TWidget}) {
  const {
    selection: {datetime},
  } = usePageFilters();
  const useRetentionLimit =
    HookStore.get('react-hook:use-dashboard-dataset-retention-limit')[0] ?? (() => null);
  const retentionLimitDays = useRetentionLimit({
    dataset: widget.widgetType ?? WidgetType.ERRORS,
  });

  if (!retentionLimitDays) {
    return null;
  }

  // Number of days from now using the stats period
  const statsPeriodDaysFromNow = statsPeriodToDays(
    datetime.period,
    datetime.start,
    datetime.end
  );

  // Convert the number of days to ms so we can get an end date to check if the
  // widget is querying more than its retention allows
  const statsPeriodToEnd = new Date(Date.now() - statsPeriodDaysFromNow * DAYS_TO_MS);
  const retentionLimitDate = new Date(Date.now() - retentionLimitDays * DAYS_TO_MS);
  if (
    (retentionLimitDate && datetime.end && retentionLimitDate > datetime.end) ||
    (retentionLimitDate && statsPeriodToEnd && retentionLimitDate > statsPeriodToEnd)
  ) {
    return tct(
      `You've selected a time range longer than the retention period for some datasets. Data older than [numDays] days may be unavailable.`,
      {
        numDays: retentionLimitDays,
      }
    );
  }

  return null;
}

// Displays a warning message if there is a conflict between widget and global filters
function useConflictingFilterWarning({
  widget,
  dashboardFilters,
}: {
  dashboardFilters: DashboardFilters | undefined;
  widget: TWidget;
}) {
  const conflictingFilterKeys = useMemo(() => {
    if (!dashboardFilters) return [];

    const widgetFilterKeys = widget.queries.flatMap(query => {
      const parseResult = parseQueryBuilderValue(query.conditions, getFieldDefinition);
      if (!parseResult) {
        return [];
      }
      return parseResult
        .filter(token => token.type === Token.FILTER)
        .map(token => token.key.text);
    });
    const globalFilterKeys =
      dashboardFilters?.[DashboardFilterKeys.GLOBAL_FILTER]
        ?.filter(filter => filter.dataset === widget.widgetType && filter.value !== '')
        .map(filter => filter.tag.key) ?? [];

    const widgetFilterKeySet = new Set(widgetFilterKeys);
    return globalFilterKeys.filter(key => widgetFilterKeySet.has(key));
  }, [widget.queries, widget.widgetType, dashboardFilters]);

  if (conflictingFilterKeys.length > 0) {
    return tct('[strong:Filter conflicts:] [filters]', {
      strong: <strong />,
      filters: conflictingFilterKeys.join(', '),
    });
  }

  return null;
}

export const WidgetDescription = styled('small')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${p => p.theme.tokens.content.secondary};
`;
