import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {CompactSelect} from 'sentry/components/compactSelect';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse} from 'sentry/types';
import {getWidgetTitle} from 'sentry/utils/metrics';
import {DEFAULT_SORT_STATE} from 'sentry/utils/metrics/constants';
import type {FocusedMetricsSeries, SortState} from 'sentry/utils/metrics/types';
import {
  type MetricsQueryApiRequestQuery,
  useMetricsQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DASHBOARD_CHART_GROUP} from 'sentry/views/dashboards/dashboard';
import {getTableSeries, MetricTable} from 'sentry/views/dashboards/metrics/table';
import {toMetricDisplayType} from 'sentry/views/dashboards/metrics/utils';
import {DisplayType} from 'sentry/views/dashboards/types';
import {displayTypes} from 'sentry/views/dashboards/widgetBuilder/utils';
import {getIngestionSeriesId, MetricChart} from 'sentry/views/ddm/chart/chart';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';
import {useSeriesHover} from 'sentry/views/ddm/useSeriesHover';
import {createChartPalette} from 'sentry/views/ddm/utils/metricsChartPalette';
import {getChartTimeseries} from 'sentry/views/ddm/widget';

function useFocusedSeries({
  timeseriesData,
  queries,
  onChange,
}: {
  queries: MetricsQueryApiRequestQuery[];
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
      if (focusedSeries?.length === 1 && focusedSeries[0].id === series.id) {
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

const supportedDisplayTypes = Object.keys(displayTypes)
  .filter(d => d !== DisplayType.BIG_NUMBER)
  .map(value => ({
    label: displayTypes[value],
    value,
  }));

interface MetricVisualizationProps {
  displayType: DisplayType;
  onDisplayTypeChange: (displayType: DisplayType) => void;
  queries: MetricsQueryApiRequestQuery[];
}

export function MetricVisualization({
  queries,
  displayType,
  onDisplayTypeChange,
}: MetricVisualizationProps) {
  const {selection} = usePageFilters();

  const isTable = displayType === DisplayType.TABLE;

  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(queries, selection, {
    intervalLadder: displayType === DisplayType.BAR ? 'bar' : 'dashboard',
  });

  const widgetMQL = useMemo(() => getWidgetTitle(queries), [queries]);

  if (!timeseriesData || isError) {
    return (
      <StyledMetricChartContainer>
        {isLoading && <LoadingIndicator />}
        {isError && (
          <Alert type="error">
            {error?.responseJSON?.detail || t('Error while fetching metrics data')}
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
          size="xs"
          triggerProps={{prefix: t('Visualization')}}
          value={displayType}
          options={supportedDisplayTypes}
          onChange={({value}) => onDisplayTypeChange(value as DisplayType)}
        />
      </ViualizationHeader>
      {!isTable ? (
        <MetricChartVisualization
          isLoading={isLoading}
          timeseriesData={timeseriesData}
          queries={queries}
          displayType={displayType}
        />
      ) : (
        <MetricTableVisualization
          isLoading={isLoading}
          timeseriesData={timeseriesData}
          queries={queries}
        />
      )}
    </StyledOuterContainer>
  );
}

interface MetricTableVisualizationProps {
  isLoading: boolean;
  queries: MetricsQueryApiRequestQuery[];
  timeseriesData: MetricsQueryApiResponse;
}

function MetricTableVisualization({
  timeseriesData,
  queries,
  isLoading,
}: MetricTableVisualizationProps) {
  const tableSeries = useMemo(() => {
    return timeseriesData ? getTableSeries(timeseriesData, queries) : [];
  }, [timeseriesData, queries]);

  return (
    <StyledMetricChartContainer>
      <TransparentLoadingMask visible={isLoading} />
      <MetricTable isLoading={isLoading} data={tableSeries} />{' '}
    </StyledMetricChartContainer>
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
    <StyledMetricChartContainer>
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
    </StyledMetricChartContainer>
  );
}

const StyledOuterContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const StyledMetricChartContainer = styled('div')`
  padding: ${space(2)};
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
  padding-left: ${space(2)};
  padding-top: ${space(1.5)};
  padding-right: ${space(2)};
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
