import {useTheme} from '@emotion/react';

import type {DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {
  filterToColor,
  type SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {transformData} from 'sentry/views/performance/transactionSummary/transactionOverview/durationPercentileChart/utils';
import {EAPWidgetType} from 'sentry/views/performance/transactionSummary/transactionOverview/eapChartsWidget';

import DurationPercentileChart from './durationPercentileChart/chart';

type Options = {
  selectedWidget: EAPWidgetType;
  transactionName: string;
};

/**
 * Returns the representative visualization for the selected widget. Handles data fetching, error handling, and loading states.
 *
 * @param options
 * @returns Visualization
 */
export function useWidgetChartVisualization({
  selectedWidget,
  transactionName,
}: Options): React.ReactNode {
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );
  const {selection} = usePageFilters();
  const theme = useTheme();
  const query = new MutableSearch('');
  query.addFilterValue('transaction', transactionName);
  if (spanCategoryUrlParam) {
    query.addFilterValue('span.category', spanCategoryUrlParam);
  }

  const durationBreakdownVisualization = useDurationBreakdownVisualization({
    enabled: selectedWidget === EAPWidgetType.DURATION_BREAKDOWN,
    transactionName,
  });

  const {
    data: durationPercentilesData,
    isPending: isDurationPercentilesPending,
    isError: isDurationPercentilesError,
  } = useEAPSpans(
    {
      fields: [
        'p50(span.duration)',
        'p75(span.duration)',
        'p90(span.duration)',
        'p95(span.duration)',
        'p99(span.duration)',
        'p100(span.duration)',
      ],
      search: query,
      pageFilters: selection,
      enabled: selectedWidget === EAPWidgetType.DURATION_PERCENTILES,
    },
    'transaction-summary-charts-widget'
  );

  if (selectedWidget === EAPWidgetType.DURATION_BREAKDOWN) {
    return durationBreakdownVisualization;
  }

  if (selectedWidget === EAPWidgetType.DURATION_PERCENTILES) {
    if (isDurationPercentilesPending || isDurationPercentilesError) {
      return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
    }

    const colors = () =>
      spanCategoryUrlParam === undefined
        ? theme.chart.getColorPalette(1)
        : [filterToColor(spanCategoryUrlParam as SpanOperationBreakdownFilter, theme)];

    return (
      <DurationPercentileChart
        series={transformData(durationPercentilesData, false, /p(\d+)\(/)}
        colors={colors}
      />
    );
  }

  return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
}

type DurationBreakdownVisualizationOptions = {
  enabled: boolean;
  transactionName: string;
};

function useDurationBreakdownVisualization({
  enabled,
  transactionName,
}: DurationBreakdownVisualizationOptions) {
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );

  const query = new MutableSearch('');
  query.addFilterValue('transaction', transactionName);
  query.addFilterValue('is_transaction', '1');

  // If a span category is selected, the chart will focus on that span category rather than just the service entry span
  if (spanCategoryUrlParam) {
    query.addFilterValue('span.category', spanCategoryUrlParam);
    query.removeFilterValue('is_transaction', '1');
  }

  const {
    data: spanSeriesData,
    isPending: isSpanSeriesPending,
    isError: isSpanSeriesError,
  } = useSpanIndexedSeries(
    {
      yAxis: [
        'avg(span.duration)',
        'p100(span.duration)',
        'p99(span.duration)',
        'p95(span.duration)',
        'p90(span.duration)',
        'p75(span.duration)',
        'p50(span.duration)',
      ],
      search: query,
      transformAliasToInputFormat: true,
      enabled,
    },

    'transaction-summary-charts-widget',
    DiscoverDatasets.SPANS_EAP
  );

  if (!enabled) {
    return null;
  }

  if (isSpanSeriesPending || isSpanSeriesError) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }

  const timeSeries: TimeSeries[] = [];
  Object.entries(spanSeriesData).forEach(([key, value]) => {
    timeSeries.push({
      field: key,
      meta: {
        type: value.meta?.fields?.[key] ?? null,
        unit: value.meta?.units?.[key] as DataUnit,
      },
      data:
        value.data.map(item => ({
          timestamp: item.name.toString(),
          value: item.value,
        })) ?? [],
    });
  });

  const plottables = timeSeries.map(series => new Area(series));

  return <TimeSeriesWidgetVisualization plottables={plottables} />;
}
