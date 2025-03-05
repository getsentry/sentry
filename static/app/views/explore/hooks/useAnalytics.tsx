import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
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
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {usePerformanceSubscriptionDetails} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/usePerformanceSubscriptionDetails';

const {info, fmt} = Sentry._experiment_log;

export function useTrackAnalytics({
  queryType,
  aggregatesTableResult,
  spansTableResult,
  tracesTableResult,
  timeseriesResult,
  dataset,
  title,
  query,
  fields,
  visualizes,
  page_source,
}: {
  aggregatesTableResult: AggregatesTableResult;
  dataset: DiscoverDatasets;
  fields: string[];
  page_source: 'explore' | 'compare';
  query: string;
  queryType: 'aggregate' | 'samples' | 'traces';
  spansTableResult: SpansTableResult;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  visualizes: Visualize[];
  title?: string;
  tracesTableResult?: TracesTableResult;
}) {
  const organization = useOrganization();

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();

  const tableError =
    queryType === 'aggregate'
      ? aggregatesTableResult.result.error?.message ?? ''
      : queryType === 'traces'
        ? tracesTableResult?.result.error?.message ?? ''
        : spansTableResult.result.error?.message ?? '';
  const chartError = timeseriesResult.error?.message ?? '';
  const query_status = tableError || chartError ? 'error' : 'success';

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
      query_status,
      result_length: aggregatesTableResult.result.data?.length || 0,
      result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes: visualizes.map(visualize => ({
        chartType: visualize.chartType,
        yAxes: visualize.yAxes,
      })),
      visualizes_count: visualizes.length,
      title: title || '',
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
    });

    info(fmt`trace.explorer.metadata:
      organization: ${organization.slug}
      dataset: ${dataset}
      query: ${query}
      visualizes: ${visualizes.map(v => v.chartType).join(', ')}
      title: ${title || ''}
      queryType: ${queryType}
      result_length: ${String(aggregatesTableResult.result.data?.length || 0)}
      user_queries: ${search.formatString()}
      user_queries_count: ${String(String(search.tokens).length)}
      visualizes_count: ${String(String(visualizes).length)}
      has_exceeded_performance_usage_limit: ${String(hasExceededPerformanceUsageLimit)}
      page_source: ${page_source}
    `);
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
    query_status,
    page_source,
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
      query_status,
      result_length: spansTableResult.result.data?.length || 0,
      result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      title: title || '',
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
    });

    info(fmt`trace.explorer.metadata:
      organization: ${organization.slug}
      dataset: ${dataset}
      query: ${query}
      visualizes: ${visualizes.map(v => v.chartType).join(', ')}
      title: ${title || ''}
      queryType: ${queryType}
      result_length: ${String(spansTableResult.result.data?.length || 0)}
      user_queries: ${search.formatString()}
      user_queries_count: ${String(search.tokens.length)}
      visualizes_count: ${String(visualizes.length)}
      has_exceeded_performance_usage_limit: ${String(hasExceededPerformanceUsageLimit)}
      page_source: ${page_source}
    `);
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
    query_status,
    page_source,
  ]);

  const tracesTableResultDefined = defined(tracesTableResult);

  useEffect(() => {
    if (
      !tracesTableResultDefined ||
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
      tracesTableResult?.result?.data?.data?.filter(trace => !defined(trace.name))
        .length ?? 0;

    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataset,
      result_mode: 'trace samples',
      columns,
      columns_count: columns.length,
      query_status,
      result_length: tracesTableResult.result.data?.data?.length || 0,
      result_missing_root: resultMissingRoot,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes,
      visualizes_count: visualizes.length,
      title: title || '',
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
    });
  }, [
    organization,
    dataset,
    fields,
    query,
    visualizes,
    title,
    queryType,
    tracesTableResult?.result.isPending,
    tracesTableResult?.result.status,
    tracesTableResult?.result.data?.data,
    timeseriesResult.isPending,
    timeseriesResult.data,
    hasExceededPerformanceUsageLimit,
    isLoadingSubscriptionDetails,
    query_status,
    page_source,
    tracesTableResultDefined,
  ]);
}

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
  const dataset = useExploreDataset();
  const title = useExploreTitle();
  const query = useExploreQuery();
  const fields = useExploreFields();
  const visualizes = useExploreVisualizes();

  return useTrackAnalytics({
    queryType,
    aggregatesTableResult,
    spansTableResult,
    tracesTableResult,
    timeseriesResult,
    dataset,
    title,
    query,
    fields,
    visualizes,
    page_source: 'explore',
  });
}

export function useCompareAnalytics({
  query: queryParts,
  index,
  queryType,
  aggregatesTableResult,
  spansTableResult,
  timeseriesResult,
}: {
  aggregatesTableResult: AggregatesTableResult;
  index: number;
  query: ReadableExploreQueryParts;
  queryType: 'aggregate' | 'samples' | 'traces';
  spansTableResult: SpansTableResult;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}) {
  const dataset = DiscoverDatasets.SPANS_EAP_RPC;
  const query = queryParts.query;
  const fields = queryParts.fields;
  const visualizes = queryParts.yAxes.map(yAxis => {
    return {
      chartType: queryParts.chartType,
      yAxes: [yAxis],
      label: String(index),
    } as Visualize;
  });

  return useTrackAnalytics({
    queryType,
    aggregatesTableResult,
    spansTableResult,
    timeseriesResult,
    dataset,
    query,
    fields,
    visualizes,
    page_source: 'compare',
  });
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
