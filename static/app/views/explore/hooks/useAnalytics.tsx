import {useEffect} from 'react';

import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useExploreDataset,
  useExploreFields,
  useExploreQuery,
  useExploreTitle,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {usePerformanceSubscriptionDetails} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/usePerformanceSubscriptionDetails';

export function useAnalytics({
  queryType,
  aggregatesTableResult,
  spansTableResult,
  tracesTableResult,
  timeseriesResult,
}: {
  aggregatesTableResult: AggregatesTableResult;
  queryType: 'aggregate' | 'samples' | 'traces';
  spansTableResult: SpansTableResult;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  tracesTableResult: TracesTableResult;
}) {
  const organization = useOrganization();
  const dataset = useExploreDataset();
  const title = useExploreTitle();
  const query = useExploreQuery();
  const fields = useExploreFields();
  const visualizes = useExploreVisualizes();

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();

  useEffect(() => {
    if (
      queryType !== 'aggregate' ||
      aggregatesTableResult.result.isPending ||
      timeseriesResult.isPending ||
      isLoadingSubscriptionDetails
    ) {
      return;
    }

    const search = new MutableSearch(query);
    const columns = aggregatesTableResult.eventView.getColumns() as unknown as string[];
    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataset,
      result_mode: 'aggregates',
      columns,
      columns_count: columns.length,
      query_status: aggregatesTableResult.result.status,
      result_length: aggregatesTableResult.result.data?.length || 0,
      result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      title: title || '',
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
    });
  }, [
    organization,
    dataset,
    fields,
    query,
    visualizes,
    title,
    queryType,
    aggregatesTableResult.result.isPending,
    aggregatesTableResult.result.status,
    aggregatesTableResult.result.data?.length,
    aggregatesTableResult.eventView,
    timeseriesResult.isPending,
    timeseriesResult.data,
    hasExceededPerformanceUsageLimit,
    isLoadingSubscriptionDetails,
  ]);

  useEffect(() => {
    if (
      queryType !== 'samples' ||
      spansTableResult.result.isPending ||
      timeseriesResult.isPending ||
      isLoadingSubscriptionDetails
    ) {
      return;
    }

    const search = new MutableSearch(query);
    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataset,
      result_mode: 'span samples',
      columns: fields,
      columns_count: fields.length,
      query_status: spansTableResult.result.status,
      result_length: spansTableResult.result.data?.length || 0,
      result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      title: title || '',
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
    });
  }, [
    organization,
    dataset,
    fields,
    query,
    visualizes,
    title,
    queryType,
    spansTableResult.result.isPending,
    spansTableResult.result.status,
    spansTableResult.result.data?.length,
    timeseriesResult.isPending,
    timeseriesResult.data,
    hasExceededPerformanceUsageLimit,
    isLoadingSubscriptionDetails,
  ]);

  useEffect(() => {
    if (
      queryType !== 'traces' ||
      tracesTableResult.result.isPending ||
      timeseriesResult.isPending ||
      isLoadingSubscriptionDetails
    ) {
      return;
    }

    const search = new MutableSearch(query);
    const columns = [
      'trace id',
      'trace root',
      'total spans',
      'timeline',
      'root duration',
      'timestamp',
    ];
    const resultMissingRoot =
      tracesTableResult.result?.data?.data?.filter(trace => !defined(trace.name))
        .length ?? 0;

    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataset,
      result_mode: 'trace samples',
      columns,
      columns_count: columns.length,
      query_status: tracesTableResult.result.status,
      result_length: tracesTableResult.result.data?.data?.length || 0,
      result_missing_root: resultMissingRoot,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      title: title || '',
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
    });
  }, [
    organization,
    dataset,
    fields,
    query,
    visualizes,
    title,
    queryType,
    tracesTableResult.result.isPending,
    tracesTableResult.result.status,
    tracesTableResult.result.data?.data,
    timeseriesResult.isPending,
    timeseriesResult.data,
    hasExceededPerformanceUsageLimit,
    isLoadingSubscriptionDetails,
  ]);
}

function computeConfidence(
  visualizes: Visualize[],
  data: ReturnType<typeof useSortedTimeSeries>['data']
) {
  return visualizes.map(visualize => {
    const dedupedYAxes = dedupeArray(visualize.yAxes);
    const series = dedupedYAxes.flatMap(yAxis => data[yAxis]).filter(defined);
    return String(combineConfidenceForSeries(series));
  });
}
