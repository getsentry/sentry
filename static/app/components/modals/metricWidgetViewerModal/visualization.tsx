import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {CompactSelect} from 'sentry/components/compactSelect';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getIngestionSeriesId, MetricChart} from 'sentry/components/metrics/chart/chart';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse} from 'sentry/types/metrics';
import {DEFAULT_SORT_STATE} from 'sentry/utils/metrics/constants';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {
  type FocusedMetricsSeries,
  MetricExpressionType,
  type SortState,
} from 'sentry/utils/metrics/types';
import {
  type MetricsQueryApiQueryParams,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DASHBOARD_CHART_GROUP} from 'sentry/views/dashboards/dashboard';
import {BigNumber, getBigNumberData} from 'sentry/views/dashboards/metrics/bigNumber';
import {getTableData, MetricTable} from 'sentry/views/dashboards/metrics/table';
import type {
  DashboardMetricsExpression,
  Order,
} from 'sentry/views/dashboards/metrics/types';
import {
  expressionsToApiQueries,
  getMetricWidgetTitle,
  toMetricDisplayType,
} from 'sentry/views/dashboards/metrics/utils';
import {DisplayType} from 'sentry/views/dashboards/types';
import {displayTypes} from 'sentry/views/dashboards/widgetBuilder/utils';
import {LoadingScreen} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';
import {SummaryTable} from 'sentry/views/metrics/summaryTable';
import {useSeriesHover} from 'sentry/views/metrics/useSeriesHover';
import {createChartPalette} from 'sentry/views/metrics/utils/metricsChartPalette';
import {useMetricsIntervalOptions} from 'sentry/views/metrics/utils/useMetricsIntervalParam';
import {getChartTimeseries} from 'sentry/views/metrics/widget';

function useFocusedSeries({
  timeseriesData,
  queries,
  onChange,
}: {
  queries: MetricsQueryApiQueryParams[];
  timeseriesData: MetricsQueryApiResponse | null;
  onChange?: () => void;
}) {
  const [focusedSeries, setFocusedSeries] = useState<FocusedMetricsSeries[]>([]);

  const chartSeries = useMemo(() => {
    return timeseriesData
      ? getChartTimeseries(timeseriesData, queries, {
          getChartPalette: createChartPalette,
          focusedSeries: focusedSeries && new Set(focusedSeries?.map(s => s.id)),
        })
      : [];
  }, [timeseriesData, focusedSeries, queries]);

  const toggleSeriesVisibility = useCallback(
    (series: FocusedMetricsSeries) => {
      onChange?.();

      // The focused series array is not populated yet, so we can add all series except the one that was de-selected
      if (!focusedSeries || focusedSeries.length === 0) {
        setFocusedSeries(
          chartSeries
            .filter(s => s.id !== series.id)
            .map(s => ({
              id: s.id,
              groupBy: s.groupBy,
            }))
        );
        return;
      }

      const filteredSeries = focusedSeries.filter(s => s.id !== series.id);

      if (filteredSeries.length === focusedSeries.length) {
        // The series was not focused before so we can add it
        filteredSeries.push(series);
      }

      setFocusedSeries(filteredSeries);
    },
    [chartSeries, focusedSeries, onChange]
  );

  const setSeriesVisibility = useCallback(
    (series: FocusedMetricsSeries) => {
      onChange?.();
      if (focusedSeries?.length === 1 && focusedSeries[0]!.id === series.id) {
        setFocusedSeries([]);
        return;
      }
      setFocusedSeries([series]);
    },
    [focusedSeries, onChange]
  );

  useEffect(() => {
    setFocusedSeries([]);
  }, [queries]);

  return {
    toggleSeriesVisibility,
    setSeriesVisibility,
    chartSeries,
  };
}

interface MetricVisualizationProps {
  displayType: DisplayType;
  expressions: DashboardMetricsExpression[];
  interval: string;
  onDisplayTypeChange: (displayType: DisplayType) => void;
  onOrderChange?: ({id, order}: {id: number; order: Order}) => void;
}

const EMPTY_FN = () => {};

export function MetricVisualization({
  expressions,
  displayType,
  onDisplayTypeChange,
  onOrderChange,
  interval,
}: MetricVisualizationProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const metricsNewInputs = hasMetricsNewInputs(organization);
  const hasSetMetric = useMemo(
    () =>
      expressions.some(
        expression =>
          expression.type === MetricExpressionType.QUERY &&
          parseMRI(expression.mri)!.type === 's'
      ),
    [expressions]
  );
  const {interval: validatedInterval} = useMetricsIntervalOptions({
    interval,
    hasSetMetric,
    datetime: selection.datetime,
    onIntervalChange: EMPTY_FN,
  });

  const queries = useMemo(
    () => expressionsToApiQueries(expressions, metricsNewInputs),
    [expressions, metricsNewInputs]
  );

  const {
    data: timeseriesData,
    isPending,
    isError,
    error,
  } = useMetricsQuery(queries, selection, {
    interval: validatedInterval,
  });

  const widgetMQL = useMemo(() => getMetricWidgetTitle(expressions), [expressions]);

  const visualizationComponent = useMemo(() => {
    if (!timeseriesData) {
      return <LoadingIndicator />;
    }
    if (displayType === DisplayType.TABLE) {
      return (
        <MetricTableVisualization
          isLoading={isPending}
          timeseriesData={timeseriesData}
          queries={queries}
          onOrderChange={onOrderChange}
        />
      );
    }
    if (displayType === DisplayType.BIG_NUMBER) {
      return (
        <MetricBigNumberVisualization
          timeseriesData={timeseriesData}
          isLoading={isPending}
          queries={queries}
        />
      );
    }

    return (
      <MetricChartVisualization
        isLoading={isPending}
        timeseriesData={timeseriesData}
        queries={queries}
        displayType={displayType}
      />
    );
  }, [timeseriesData, displayType, isPending, queries, onOrderChange]);

  if (isError && !timeseriesData) {
    return (
      <StyledMetricChartContainer>
        {isPending && <LoadingIndicator />}
        {isError && (
          <Alert type="error">
            {(error?.responseJSON?.detail as string) ||
              t('Error while fetching metrics data')}
          </Alert>
        )}
      </StyledMetricChartContainer>
    );
  }

  return (
    <StyledOuterContainer>
      <ViualizationHeader>
        <WidgetTitle>
          <StyledTooltip
            title={widgetMQL}
            showOnlyOnOverflow
            delay={500}
            overlayStyle={{maxWidth: '90vw'}}
          >
            {widgetMQL}
          </StyledTooltip>
        </WidgetTitle>
        <CompactSelect
          size="sm"
          triggerProps={{prefix: t('Visualization')}}
          value={displayType}
          options={Object.keys(displayTypes).map(value => ({
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            label: displayTypes[value],
            value,
          }))}
          onChange={({value}) => onDisplayTypeChange(value as DisplayType)}
        />
      </ViualizationHeader>
      {visualizationComponent}
    </StyledOuterContainer>
  );
}

interface MetricTableVisualizationProps {
  isLoading: boolean;
  queries: MetricsQueryApiQueryParams[];
  timeseriesData: MetricsQueryApiResponse;
  onOrderChange?: ({id, order}: {id: number; order: Order}) => void;
}

function MetricTableVisualization({
  timeseriesData,
  queries,
  isLoading,
  onOrderChange,
}: MetricTableVisualizationProps) {
  const tableData = useMemo(() => {
    return getTableData(timeseriesData, queries);
  }, [timeseriesData, queries]);

  const handleOrderChange = useCallback(
    (column: {id: number; order: Order}) => {
      onOrderChange?.(column);
    },
    [onOrderChange]
  );

  return (
    <Fragment>
      <TransparentLoadingMask visible={isLoading} />
      <MetricTable
        isLoading={isLoading}
        data={tableData}
        onOrderChange={handleOrderChange}
      />
    </Fragment>
  );
}

function MetricBigNumberVisualization({
  timeseriesData,
  isLoading,
}: MetricTableVisualizationProps) {
  const bigNumberData = useMemo(() => {
    return timeseriesData ? getBigNumberData(timeseriesData) : undefined;
  }, [timeseriesData]);

  if (!bigNumberData) {
    return null;
  }

  return (
    <Fragment>
      <LoadingScreen loading={isLoading} />
      <BigNumber>{bigNumberData}</BigNumber>
    </Fragment>
  );
}

interface MetricChartVisualizationProps extends MetricTableVisualizationProps {
  displayType: DisplayType;
}

function MetricChartVisualization({
  timeseriesData,
  queries,
  displayType,
  isLoading,
}: MetricChartVisualizationProps) {
  const {chartRef, setHoveredSeries} = useSeriesHover();

  const handleHoverSeries = useCallback(
    (seriesId: string) => {
      setHoveredSeries([seriesId, getIngestionSeriesId(seriesId)]);
    },
    [setHoveredSeries]
  );

  const {chartSeries, toggleSeriesVisibility, setSeriesVisibility} = useFocusedSeries({
    timeseriesData,
    queries,
    onChange: () => handleHoverSeries(''),
  });
  const [tableSort, setTableSort] = useState<SortState>(DEFAULT_SORT_STATE);

  return (
    <Fragment>
      <TransparentLoadingMask visible={isLoading} />
      <MetricChart
        ref={chartRef}
        series={chartSeries}
        displayType={toMetricDisplayType(displayType)}
        group={DASHBOARD_CHART_GROUP}
        height={200}
      />
      <SummaryTable
        series={chartSeries}
        onSortChange={setTableSort}
        sort={tableSort}
        onRowClick={setSeriesVisibility}
        onColorDotClick={toggleSeriesVisibility}
        onRowHover={handleHoverSeries}
      />
    </Fragment>
  );
}

const StyledOuterContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const StyledMetricChartContainer = styled('div')`
  gap: ${space(3)};
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
`;

const ViualizationHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
`;

const WidgetTitle = styled('div')`
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  display: inline-grid;
  grid-auto-flow: column;
`;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;
