import type {Ref} from 'react';
import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import type {ChartXRangeSelectionProps} from 'sentry/components/charts/useChartXRangeSelection';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import usePrevious from 'sentry/utils/usePrevious';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

interface ChartVisualizationProps {
  chartInfo: ChartInfo;
  chartRef?: Ref<ReactEchartsRef>;
  chartXRangeSelection?: Partial<ChartXRangeSelectionProps>;
  hidden?: boolean;
}

/**
 * Creates a display-friendly alias for a time series.
 *
 * @param series - The time series data
 * @param label - Optional display label to use (e.g., from metric context like "avg(metric.name)")
 *
 * For series without groupBy, this uses the provided label or prettifies the aggregation.
 * For series with groupBy, the default behavior of showing the grouped values is used.
 */
export function getSeriesAlias(series: TimeSeries, label?: string): string | undefined {
  // If there's groupBy information, let the default formatting handle it
  // since it will show the grouped values (e.g., "GET /api/users")
  if (series.groupBy?.length && series.groupBy.length > 0) {
    return undefined;
  }

  if (label) {
    return label;
  }

  // For non-grouped series, prettify the aggregation function
  const prettified = prettifyAggregation(series.yAxis);
  if (prettified && prettified !== series.yAxis) {
    return prettified;
  }

  // Fall back to default label formatting
  return formatTimeSeriesLabel(series);
}

export function ChartVisualization({
  chartXRangeSelection,
  chartInfo,
  chartRef,
}: ChartVisualizationProps) {
  const theme = useTheme();

  const plottables = useMemo(() => {
    const DataPlottableConstructor =
      chartInfo.chartType === ChartType.LINE
        ? Line
        : chartInfo.chartType === ChartType.AREA
          ? Area
          : Bars;

    return chartInfo.series.map(s => {
      const alias = getSeriesAlias(s, chartInfo.label);
      return new DataPlottableConstructor(markDelayedData(s, INGESTION_DELAY), {
        alias,
        color: s.meta.isOther ? theme.tokens.content.secondary : undefined,
        stack: 'all',
      });
    });
  }, [chartInfo, theme]);

  const previousPlottables = usePrevious(
    plottables,
    chartInfo.timeseriesResult.isPending
  );

  if (chartInfo.timeseriesResult.isPending) {
    if (previousPlottables.length === 0) {
      const loadingMessage =
        chartInfo.timeseriesResult.isFetching &&
        chartInfo.samplingMode === SAMPLING_MODE.HIGH_ACCURACY
          ? t(
              "Hey, we're scanning all the data we can to answer your query, so please wait a bit longer"
            )
          : undefined;
      return (
        <TimeSeriesWidgetVisualization.LoadingPlaceholder
          loadingMessage={loadingMessage}
          expectMessage
        />
      );
    }

    return (
      <StyledTransparentLoadingMask visible>
        <TimeSeriesWidgetVisualization
          ref={chartRef}
          plottables={previousPlottables}
          chartXRangeSelection={chartXRangeSelection}
        />
      </StyledTransparentLoadingMask>
    );
  }

  if (chartInfo.timeseriesResult.error) {
    return <Widget.WidgetError error={chartInfo.timeseriesResult.error} />;
  }

  if (plottables.length === 0) {
    // This happens when the `/events-stats/` endpoint returns a blank
    // response. This is a rare error condition that happens when
    // proxying to RPC. Adding explicit handling with a "better" message
    return <Widget.WidgetError error={t('No data')} />;
  }

  return (
    <TimeSeriesWidgetVisualization
      ref={chartRef}
      plottables={plottables}
      chartXRangeSelection={chartXRangeSelection}
    />
  );
}

const StyledTransparentLoadingMask = styled(TransparentLoadingMask)`
  position: relative;
  height: 100%;
`;
