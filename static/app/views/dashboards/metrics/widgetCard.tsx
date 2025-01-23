import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {EquationFormatter} from 'sentry/components/metrics/equationInput/syntax/formatter';
import TextOverflow from 'sentry/components/textOverflow';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {getFormattedMQL, unescapeMetricsFormula} from 'sentry/utils/metrics';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import {MetricExpressionType} from 'sentry/utils/metrics/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import {MetricBigNumberContainer} from 'sentry/views/dashboards/metrics/bigNumber';
import {MetricChartContainer} from 'sentry/views/dashboards/metrics/chart';
import {MetricTableContainer} from 'sentry/views/dashboards/metrics/table';
import type {DashboardMetricsExpression} from 'sentry/views/dashboards/metrics/types';
import {
  expressionsToApiQueries,
  formatAlias,
  getMetricExpressions,
  isMetricsEquation,
  toMetricDisplayType,
} from 'sentry/views/dashboards/metrics/utils';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';
import {WidgetCardContextMenuContainer} from 'sentry/views/dashboards/widgetCard/widgetCardContextMenuContainer';
import {WidgetCardPanel} from 'sentry/views/dashboards/widgetCard/widgetCardPanel';
import {useMetricsIntervalOptions} from 'sentry/views/metrics/utils/useMetricsIntervalParam';

type Props = {
  isEditingDashboard: boolean;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  index?: string;
  isMobile?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: (index: string) => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showContextMenu?: boolean;
};

const EMPTY_FN = () => {};

export function getWidgetTitle(expressions: DashboardMetricsExpression[]) {
  const filteredExpressions = expressions.filter(query => !query.isQueryOnly);

  if (filteredExpressions.length === 1) {
    const firstQuery = filteredExpressions[0]!;
    if (isMetricsEquation(firstQuery)) {
      return (
        <Fragment>
          <EquationFormatter equation={unescapeMetricsFormula(firstQuery.formula)} />
        </Fragment>
      );
    }
    return formatAlias(firstQuery.alias) ?? getFormattedMQL(firstQuery);
  }

  return filteredExpressions
    .map(q =>
      isMetricsEquation(q)
        ? formatAlias(q.alias) ?? unescapeMetricsFormula(q.formula)
        : formatAlias(q.alias) ?? formatMRIField(MRIToField(q.mri, q.aggregation))
    )
    .join(', ');
}

export function MetricWidgetCard({
  organization,
  selection,
  widget,
  isEditingDashboard,
  onDelete,
  onDuplicate,
  location,
  router,
  dashboardFilters,
  renderErrorMessage,
  showContextMenu = true,
}: Props) {
  const metricsNewInputs = hasMetricsNewInputs(organization);
  const {getVirtualMRIQuery, isLoading: isLoadingVirtualMetrics} =
    useVirtualMetricsContext();

  const metricExpressions = getMetricExpressions(
    widget,
    dashboardFilters,
    getVirtualMRIQuery
  );

  const hasSetMetric = useMemo(
    () =>
      metricExpressions.some(
        expression =>
          expression.type === MetricExpressionType.QUERY &&
          parseMRI(expression.mri)!.type === 's'
      ),
    [metricExpressions]
  );

  const widgetMQL = useMemo(
    () => (isLoadingVirtualMetrics ? '' : getWidgetTitle(metricExpressions)),
    [isLoadingVirtualMetrics, metricExpressions]
  );

  const metricQueries = useMemo(() => {
    const formattedAliasQueries = expressionsToApiQueries(
      metricExpressions,
      metricsNewInputs
    ).map(query => {
      if (query.alias) {
        return {...query, alias: formatAlias(query.alias)};
      }
      return query;
    });
    return [...formattedAliasQueries];
  }, [metricExpressions, metricsNewInputs]);

  const {interval: validatedInterval} = useMetricsIntervalOptions({
    // TODO: Figure out why this can be undefined
    interval: widget.interval ?? '',
    hasSetMetric,
    datetime: selection.datetime,
    onIntervalChange: EMPTY_FN,
  });

  const {
    data: timeseriesData,
    isPending,
    isError,
    error,
  } = useMetricsQuery(metricQueries, selection, {
    interval: validatedInterval,
  });

  const vizualizationComponent = useMemo(() => {
    if (widget.displayType === DisplayType.TABLE) {
      return (
        <MetricTableContainer
          metricQueries={metricQueries}
          timeseriesData={timeseriesData}
          isLoading={isPending}
        />
      );
    }
    if (widget.displayType === DisplayType.BIG_NUMBER) {
      return (
        <MetricBigNumberContainer timeseriesData={timeseriesData} isLoading={isPending} />
      );
    }

    return (
      <MetricChartContainer
        timeseriesData={timeseriesData}
        isLoading={isPending}
        metricQueries={metricQueries}
        displayType={toMetricDisplayType(widget.displayType)}
        chartHeight={!showContextMenu ? 200 : undefined}
        showLegend
      />
    );
  }, [widget.displayType, metricQueries, timeseriesData, isPending, showContextMenu]);

  return (
    <DashboardsMEPContext.Provider
      value={{
        isMetricsData: undefined,
        setIsMetricsData: () => {},
      }}
    >
      <WidgetCardPanel isDragging={false}>
        <WidgetHeaderWrapper>
          <WidgetHeaderDescription>
            <WidgetTitleRow>
              <WidgetTitle>
                <TextOverflow>{widget.title || widgetMQL}</TextOverflow>
              </WidgetTitle>
            </WidgetTitleRow>
          </WidgetHeaderDescription>

          <ContextMenuWrapper>
            {showContextMenu && !isEditingDashboard && (
              <WidgetCardContextMenuContainer>
                <WidgetCardContextMenu
                  organization={organization}
                  widget={widget}
                  selection={selection}
                  showContextMenu
                  isPreview={false}
                  widgetLimitReached={false}
                  hasEditAccess
                  onEdit={() => {
                    router.push({
                      pathname: `${location.pathname}${
                        location.pathname.endsWith('/') ? '' : '/'
                      }widget/${widget.id}/`,
                      query: location.query,
                    });
                  }}
                  router={router}
                  location={location}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  title={widget.title || widgetMQL}
                />
              </WidgetCardContextMenuContainer>
            )}
          </ContextMenuWrapper>
        </WidgetHeaderWrapper>
        <ErrorBoundary>
          <WidgetCardBody
            isError={isError}
            timeseriesData={timeseriesData}
            renderErrorMessage={renderErrorMessage}
            error={error}
          >
            {vizualizationComponent}
          </WidgetCardBody>
        </ErrorBoundary>
        {isEditingDashboard && <Toolbar onDelete={onDelete} onDuplicate={onDuplicate} />}
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
  );
}

function WidgetCardBody({
  children,
  isError,
  timeseriesData,
  renderErrorMessage,
  error,
}: any) {
  if (isError && !timeseriesData) {
    const errorMessage =
      error?.responseJSON?.detail?.toString() || t('Error while fetching metrics data');
    return (
      <ErrorWrapper>
        {renderErrorMessage?.(errorMessage)}
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      </ErrorWrapper>
    );
  }

  return children;
}

const WidgetHeaderWrapper = styled('div')`
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const ContextMenuWrapper = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
`;

const WidgetHeaderDescription = styled('div')`
  ${p => p.theme.overflowEllipsis};
  overflow-y: visible;
`;

const WidgetTitle = styled(HeaderTitle)`
  padding-left: ${space(3)};
  padding-top: ${space(2)};
  padding-right: ${space(1)};
  ${p => p.theme.overflowEllipsis};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ErrorWrapper = styled('div')`
  padding-top: ${space(1)};
`;
