import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {CompactSelect} from 'sentry/components/compactSelect';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {getWidgetTitle} from 'sentry/utils/metrics';
import {
  DEFAULT_SORT_STATE,
  metricDisplayTypeOptions,
} from 'sentry/utils/metrics/constants';
import type {FocusedMetricsSeries, SortState} from 'sentry/utils/metrics/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getIngestionSeriesId, MetricChart} from 'sentry/views/ddm/chart/chart';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';
import {createChartPalette} from 'sentry/views/ddm/utils/metricsChartPalette';
import {getChartTimeseries} from 'sentry/views/ddm/widget';

import {DASHBOARD_CHART_GROUP} from '../../../views/dashboards/dashboard';
import {DisplayType} from '../../../views/dashboards/types';

function useFocusedSeries({timeseriesData, queries, onChange}) {
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

function useHoverSeries() {
  const chartRef = useRef<ReactEchartsRef>(null);

  const setHoveredSeries = useCallback((seriesId: string) => {
    if (!chartRef.current) {
      return;
    }
    const echartsInstance = chartRef.current.getEchartsInstance();
    echartsInstance.dispatchAction({
      type: 'highlight',
      seriesId: [seriesId, getIngestionSeriesId(seriesId)],
    });
  }, []);

  const resetHoveredSeries = useCallback(() => {
    setHoveredSeries('');
  }, [setHoveredSeries]);

  return {
    chartRef,
    setHoveredSeries,
    resetHoveredSeries,
  };
}

// TODO: add types
export function MetricVisualization({queries, displayType, onDisplayTypeChange}) {
  const {selection} = usePageFilters();
  const [tableSort, setTableSort] = useState<SortState>(DEFAULT_SORT_STATE);

  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(queries, selection, {
    intervalLadder: displayType === DisplayType.BAR ? 'bar' : 'dashboard',
  });

  const {chartRef, setHoveredSeries, resetHoveredSeries} = useHoverSeries();

  const {chartSeries, toggleSeriesVisibility, setSeriesVisibility} = useFocusedSeries({
    timeseriesData,
    queries,
    onChange: resetHoveredSeries,
  });

  const widgetMQL = useMemo(() => getWidgetTitle(queries), [queries]);

  if (!chartSeries || !timeseriesData || isError) {
    return (
      <StyledMetricChartContainer>
        {isLoading && <LoadingIndicator />}
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
          size="xs"
          triggerProps={{prefix: t('Visualization')}}
          value={displayType}
          options={metricDisplayTypeOptions}
          onChange={({value}) => onDisplayTypeChange(value) as DisplayType}
        />
      </ViualizationHeader>
      <StyledMetricChartContainer>
        <TransparentLoadingMask visible={isLoading} />
        <MetricChart
          ref={chartRef}
          series={chartSeries}
          displayType={displayType}
          group={DASHBOARD_CHART_GROUP}
          height={200}
        />
        <SummaryTable
          series={chartSeries}
          onSortChange={setTableSort}
          sort={tableSort}
          onRowClick={setSeriesVisibility}
          onColorDotClick={toggleSeriesVisibility}
          onRowHover={setHoveredSeries}
        />
      </StyledMetricChartContainer>
    </StyledOuterContainer>
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
