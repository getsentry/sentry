import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import type {BadgeProps} from 'sentry/components/badge/badge';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {LazyRender} from 'sentry/components/lazyRender';
import {isWidgetViewerPath} from 'sentry/components/modals/widgetViewerModal/utils';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {getFormattedDate} from 'sentry/utils/dates';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {useExtractionStatus} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import useOrganization from 'sentry/utils/useOrganization';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {DASHBOARD_CHART_GROUP} from 'sentry/views/dashboards/dashboard';
import {useDiscoverSplitAlert} from 'sentry/views/dashboards/discoverSplitAlert';
import {MetricWidgetCard} from 'sentry/views/dashboards/metrics/widgetCard';

import type {DashboardFilters, Widget} from '../types';
import {DisplayType, OnDemandExtractionState, WidgetType} from '../types';
import {DEFAULT_RESULTS_LIMIT} from '../widgetBuilder/utils';
import type WidgetLegendSelectionState from '../widgetLegendSelectionState';
import {WidgetFrame} from '../widgets/common/widgetFrame';

import {useDashboardsMEPContext} from './dashboardsMEPContext';
import WidgetCardChartContainer from './widgetCardChartContainer';
import {getMenuOptions, useIndexedEventsWarning} from './widgetCardContextMenu';

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
  dashboardFilters?: DashboardFilters;
  index?: string;
  isEditingWidget?: boolean;
  isMobile?: boolean;
  isPreview?: boolean;
  isWidgetInvalid?: boolean;
  legendOptions?: LegendComponentOption;
  noLazyLoad?: boolean;
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
  showContextMenu?: boolean;
  showStoredAlert?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

type Data = {
  pageLinks?: string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  totalIssuesCount?: string;
};

function WidgetCard(props: Props) {
  const [data, setData] = useState<Data>();

  const onDataFetched = (newData: Data) => {
    if (props.onDataFetched && newData.tableResults) {
      props.onDataFetched(newData.tableResults);
    }

    setData(newData);
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
    noLazyLoad,
    dashboardFilters,
    isWidgetInvalid,
    location,
    onWidgetSplitDecision,
    shouldResize,
    onLegendSelectChanged,
    onSetTransactionsDataset,
    legendOptions,
    widgetLegendState,
  } = props;

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

  const {isMetricsData} = useDashboardsMEPContext();
  const extractionStatus = useExtractionStatus({queryKey: widget});
  const indexedEventsWarning = useIndexedEventsWarning();
  const onDemandWarning = useOnDemandWarning({widget});
  const discoverSplitAlert = useDiscoverSplitAlert({widget, onSetTransactionsDataset});
  const sessionDurationWarning = hasSessionDuration ? SESSION_DURATION_ALERT_TEXT : null;

  if (widget.widgetType === WidgetType.METRICS) {
    return (
      <MetricWidgetCard
        index={props.index}
        isEditingDashboard={props.isEditingDashboard}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onDuplicate={props.onDuplicate}
        router={props.router}
        location={props.location}
        organization={organization}
        selection={selection}
        widget={widget}
        dashboardFilters={dashboardFilters}
        renderErrorMessage={renderErrorMessage}
        showContextMenu={props.showContextMenu}
      />
    );
  }

  const onFullScreenViewClick = () => {
    if (!isWidgetViewerPath(location.pathname)) {
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

  const warnings = [onDemandWarning, discoverSplitAlert, sessionDurationWarning].filter(
    Boolean
  ) as string[];

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
        props.onDelete,
        props.onDuplicate,
        props.onEdit
      )
    : [];

  const visualization = (
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
    />
  );

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
        <WidgetFrame
          title={widget.title}
          description={widget.description}
          badgeProps={badges}
          warnings={warnings}
          actionsDisabled={actionsDisabled}
          actionsMessage={actionsMessage}
          actions={actions}
          onFullScreenViewClick={onFullScreenViewClick}
        >
          {isWidgetInvalid ? (
            <Fragment>
              {renderErrorMessage?.('Widget query condition is invalid.')}
              <StyledErrorPanel>
                <IconWarning color="gray500" size="lg" />
              </StyledErrorPanel>
            </Fragment>
          ) : noLazyLoad ? (
            visualization
          ) : (
            <LazyRender containerHeight={200} withoutContainer>
              {visualization}
            </LazyRender>
          )}
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

export const WidgetCardContextMenuContainer = styled('div')`
  opacity: 1;
  transition: opacity 0.1s;
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

  &:not(:hover):not(:focus-within) {
    ${WidgetCardContextMenuContainer} {
      opacity: 0;
      ${p => p.theme.visuallyHidden}
    }
  }

  :hover {
    background-color: ${p => p.theme.surface200};
    transition:
      background-color 100ms linear,
      box-shadow 100ms linear;
    box-shadow: ${p => p.theme.dropShadowLight};
  }
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
