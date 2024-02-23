import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import TransitionChart from 'sentry/components/charts/transitionChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconSearch, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {
  MetricDisplayType,
  type MetricQueryWidgetParams,
} from 'sentry/utils/metrics/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {MetricChart} from 'sentry/views/ddm/chart';
import {createChartPalette} from 'sentry/views/ddm/utils/metricsChartPalette';
import {getChartTimeseries} from 'sentry/views/ddm/widget';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';

import {convertToMetricWidget} from '../../../../utils/metrics/dashboard';
import {DASHBOARD_CHART_GROUP} from '../../dashboard';
import type {Widget} from '../../types';

type MetricWidgetChartContainerProps = {
  selection: PageFilters;
  widget: Widget;
  chartHeight?: number;
  metricWidgetQueries?: MetricQueryWidgetParams[];
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
};

export function MetricWidgetChartContainer({
  selection,
  renderErrorMessage,
  metricWidgetQueries,
  widget,
  chartHeight,
}: MetricWidgetChartContainerProps) {
  // TODO: Remove this and the widget prop once this component is no longer used in widgetViewerModal
  const metricQueries = metricWidgetQueries || convertToMetricWidget(widget);

  const displayType = metricQueries[0].displayType;

  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(metricQueries, selection, {
    intervalLadder: displayType === MetricDisplayType.BAR ? 'bar' : 'dashboard',
  });

  const chartRef = useRef<ReactEchartsRef>(null);

  const chartSeries = useMemo(() => {
    return timeseriesData
      ? getChartTimeseries(timeseriesData, metricQueries, {
          getChartPalette: createChartPalette,
        })
      : [];
  }, [timeseriesData, metricQueries]);

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

const MetricWidgetChartWrapper = styled('div')`
  height: 100%;
  width: 100%;
  padding: ${space(3)};
  padding-top: ${space(2)};
`;
