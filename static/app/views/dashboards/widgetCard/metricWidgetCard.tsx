import {Fragment, useMemo, useRef} from 'react';
import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitle} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import TextOverflow from 'sentry/components/textOverflow';
import {IconSearch, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters} from 'sentry/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {getWidgetTitle} from 'sentry/utils/metrics';
import type {MetricQueryWidgetParams} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {WidgetCardPanel, WidgetTitleRow} from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {Toolbar} from 'sentry/views/dashboards/widgetCard/toolbar';
import WidgetCardContextMenu from 'sentry/views/dashboards/widgetCard/widgetCardContextMenu';
import {MetricChart} from 'sentry/views/ddm/chart/chart';
import {createChartPalette} from 'sentry/views/ddm/utils/metricsChartPalette';
import {getChartTimeseries} from 'sentry/views/ddm/widget';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';

import {convertToMetricWidget} from '../../../utils/metrics/dashboard';
import {DASHBOARD_CHART_GROUP} from '../dashboard';
import type {DashboardFilters, Widget} from '../types';

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
  const metricWidgetQueries = useMemo(() => convertToMetricWidget(widget), [widget]);

  const widgetMQL = useMemo(
    () => getWidgetTitle(metricWidgetQueries),
    [metricWidgetQueries]
  );

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
              <WidgetCardContextMenu
                organization={organization}
                widget={widget}
                selection={selection}
                showContextMenu
                isPreview={false}
                widgetLimitReached={false}
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
              />
            )}
          </ContextMenuWrapper>
        </WidgetHeaderWrapper>

        <MetricWidgetChartContainer
          metricWidgetQueries={metricWidgetQueries}
          selection={selection}
          widget={widget}
          dashboardFilters={dashboardFilters}
          renderErrorMessage={renderErrorMessage}
          chartHeight={!showContextMenu ? 200 : undefined}
        />
        {isEditingDashboard && <Toolbar onDelete={onDelete} onDuplicate={onDuplicate} />}
      </WidgetCardPanel>
    </DashboardsMEPContext.Provider>
  );
}

type MetricWidgetChartContainerProps = {
  selection: PageFilters;
  widget: Widget;
  chartHeight?: number;
  dashboardFilters?: DashboardFilters;
  metricWidgetQueries?: MetricQueryWidgetParams[];
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
};

export function MetricWidgetChartContainer({
  selection,
  dashboardFilters,
  renderErrorMessage,
  metricWidgetQueries,
  widget,
  chartHeight,
}: MetricWidgetChartContainerProps) {
  // TODO: Remove this and the widget prop once this component is no longer used in widgetViewerModal
  const metricQueries = metricWidgetQueries || convertToMetricWidget(widget);

  const chartQueries = useMemo(() => {
    return metricQueries.map(({mri, op, groupBy, query}) => {
      return {
        mri,
        op,
        query: extendQuery(query, dashboardFilters),
        groupBy,
      };
    });
  }, [metricQueries, dashboardFilters]);

  const displayType = metricQueries[0].displayType;

  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(chartQueries, selection, {
    intervalLadder: displayType === MetricDisplayType.BAR ? 'bar' : 'dashboard',
  });

  const chartRef = useRef<ReactEchartsRef>(null);

  const chartSeries = useMemo(() => {
    return timeseriesData
      ? getChartTimeseries(timeseriesData, chartQueries, {
          getChartPalette: createChartPalette,
        })
      : [];
  }, [timeseriesData, chartQueries]);

  if (isError) {
    const errorMessage =
      error?.responseJSON?.detail?.toString() || t('Error while fetching metrics data');
    return (
      <Fragment>
        {renderErrorMessage?.(errorMessage)}
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      </Fragment>
    );
  }

  if (timeseriesData?.data.length === 0) {
    return (
      <EmptyMessage
        icon={<IconSearch size="xxl" />}
        title={t('No results')}
        description={t('No results found for the given query')}
      />
    );
  }

  return (
    <MetricWidgetChartWrapper>
      <TransitionChart loading={isLoading} reloading={isLoading}>
        <LoadingScreen loading={isLoading} />
        <MetricChart
          ref={chartRef}
          series={chartSeries}
          displayType={displayType}
          widgetIndex={0}
          group={DASHBOARD_CHART_GROUP}
          height={chartHeight}
        />
      </TransitionChart>
    </MetricWidgetChartWrapper>
  );
}

function extendQuery(query = '', dashboardFilters?: DashboardFilters) {
  if (!dashboardFilters?.release?.length) {
    return query;
  }

  const releaseQuery = convertToQuery(dashboardFilters);

  return `${query} ${releaseQuery}`;
}

function convertToQuery(dashboardFilters: DashboardFilters) {
  const {release} = dashboardFilters;

  if (!release?.length) {
    return '';
  }

  if (release.length === 1) {
    return `release:${release[0]}`;
  }

  return `release:[${release.join(',')}]`;
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
  font-weight: normal;
`;

const MetricWidgetChartWrapper = styled('div')`
  height: 100%;
  width: 100%;
  padding: ${space(3)};
  padding-top: ${space(2)};
`;
