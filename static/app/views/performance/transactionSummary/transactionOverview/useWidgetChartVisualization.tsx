import {useTheme} from '@emotion/react';

import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useEAPSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {
  filterToColor,
  type SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {transformData} from 'sentry/views/performance/transactionSummary/transactionOverview/durationPercentileChart/utils';
import {EAPWidgetType} from 'sentry/views/performance/transactionSummary/transactionOverview/eapChartsWidget';
import {eapSeriesDataToTimeSeries} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';

import DurationPercentileChart from './durationPercentileChart/chart';

const REFERRER = 'transaction-summary-charts-widget';

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
  const durationBreakdownVisualization = useDurationBreakdownVisualization({
    enabled: selectedWidget === EAPWidgetType.DURATION_BREAKDOWN,
    transactionName,
  });

  const durationPercentilesVisualization = useDurationPercentilesVisualization({
    enabled: selectedWidget === EAPWidgetType.DURATION_PERCENTILES,
    transactionName,
  });

  if (selectedWidget === EAPWidgetType.DURATION_BREAKDOWN) {
    return durationBreakdownVisualization;
  }

  if (selectedWidget === EAPWidgetType.DURATION_PERCENTILES) {
    return durationPercentilesVisualization;
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
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const {releases: releasesWithDate} = useReleaseStats(selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

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
  } = useEAPSeries(
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
    REFERRER
  );

  if (!enabled) {
    return null;
  }

  if (isSpanSeriesPending || isSpanSeriesError) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }

  const timeSeries = eapSeriesDataToTimeSeries(spanSeriesData);
  const plottables = timeSeries.map(series => new Line(series));

  const enableReleaseBubblesProps = organization.features.includes('release-bubbles-ui')
    ? ({releases, showReleaseAs: 'bubble'} as const)
    : {};

  return (
    <TimeSeriesWidgetVisualization
      plottables={plottables}
      {...enableReleaseBubblesProps}
    />
  );
}

type DurationPercentilesVisualizationOptions = {
  enabled: boolean;
  transactionName: string;
};

function useDurationPercentilesVisualization({
  enabled,
  transactionName,
}: DurationPercentilesVisualizationOptions) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const theme = useTheme();

  const spanCategoryUrlParam = decodeScalar(
    location.query?.[SpanIndexedField.SPAN_CATEGORY]
  );

  const query = new MutableSearch('');
  query.addFilterValue('transaction', transactionName);
  query.addFilterValue('is_transaction', '1');

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
      enabled,
    },
    REFERRER
  );

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
