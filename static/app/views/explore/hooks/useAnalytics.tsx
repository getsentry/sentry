import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  useLogsFields,
  useLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  useExploreDataset,
  useExploreFields,
  useExploreQuery,
  useExploreTitle,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import type {
  UseInfiniteLogsQueryResult,
  UseLogsQueryResult,
} from 'sentry/views/explore/logs/useLogsQuery';
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  combineConfidenceForSeries,
  computeVisualizeSampleTotals,
} from 'sentry/views/explore/utils';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {usePerformanceSubscriptionDetails} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/usePerformanceSubscriptionDetails';

const {info, fmt} = Sentry.logger;

interface UseTrackAnalyticsProps {
  aggregatesTableResult: AggregatesTableResult;
  dataset: DiscoverDatasets;
  fields: string[];
  interval: string;
  isTopN: boolean;
  page_source: 'explore' | 'compare';
  query: string;
  queryType: 'aggregate' | 'samples' | 'traces';
  spansTableResult: SpansTableResult;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  visualizes: Visualize[];
  title?: string;
  tracesTableResult?: TracesTableResult;
}

function useTrackAnalytics({
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
  interval,
  isTopN,
}: UseTrackAnalyticsProps) {
  const organization = useOrganization();

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();

  const tableError =
    queryType === 'aggregate'
      ? (aggregatesTableResult.result.error?.message ?? '')
      : queryType === 'traces'
        ? (tracesTableResult?.result.error?.message ?? '')
        : (spansTableResult.result.error?.message ?? '');
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
      visualizes: visualizes.map(visualize => visualize.toJSON()),
      visualizes_count: visualizes.length,
      title: title || '',
      empty_buckets_percentage: computeEmptyBuckets(visualizes, timeseriesResult.data),
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      sample_counts: computeVisualizeSampleTotals(
        visualizes,
        timeseriesResult.data,
        isTopN
      ),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
      interval,
    });

    /* eslint-disable @typescript-eslint/no-base-to-string */
    info(
      fmt`trace.explorer.metadata:
      organization: ${organization.slug}
      dataset: ${dataset}
      query: [omitted]
      visualizes: ${visualizes.map(v => v.chartType).join(', ')}
      title: ${title || ''}
      queryType: ${queryType}
      result_length: ${String(aggregatesTableResult.result.data?.length || 0)}
      user_queries: ${search.formatString()}
      user_queries_count: ${String(String(search.tokens).length)}
      visualizes_count: ${String(String(visualizes).length)}
      has_exceeded_performance_usage_limit: ${String(hasExceededPerformanceUsageLimit)}
      page_source: ${page_source}
    `,
      {isAnalytics: true}
    );
    /* eslint-enable @typescript-eslint/no-base-to-string */
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
    interval,
    isTopN,
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
      visualizes: visualizes.map(visualize => visualize.toJSON()),
      visualizes_count: visualizes.length,
      title: title || '',
      empty_buckets_percentage: computeEmptyBuckets(visualizes, timeseriesResult.data),
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      sample_counts: computeVisualizeSampleTotals(
        visualizes,
        timeseriesResult.data,
        isTopN
      ),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
      interval,
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
    interval,
    isTopN,
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
      visualizes: visualizes.map(visualize => visualize.toJSON()),
      visualizes_count: visualizes.length,
      title: title || '',
      empty_buckets_percentage: computeEmptyBuckets(visualizes, timeseriesResult.data),
      confidences: computeConfidence(visualizes, timeseriesResult.data),
      sample_counts: computeVisualizeSampleTotals(
        visualizes,
        timeseriesResult.data,
        isTopN
      ),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
      interval,
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
    interval,
    isTopN,
  ]);
}

export function useAnalytics({
  queryType,
  aggregatesTableResult,
  spansTableResult,
  tracesTableResult,
  timeseriesResult,
  interval,
}: Pick<
  UseTrackAnalyticsProps,
  | 'queryType'
  | 'aggregatesTableResult'
  | 'spansTableResult'
  | 'tracesTableResult'
  | 'timeseriesResult'
  | 'interval'
>) {
  const dataset = useExploreDataset();
  const title = useExploreTitle();
  const query = useExploreQuery();
  const fields = useExploreFields();
  const visualizes = useExploreVisualizes();
  const topEvents = useTopEvents();
  const isTopN = topEvents ? topEvents > 0 : false;

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
    interval,
    page_source: 'explore',
    isTopN,
  });
}

export function useCompareAnalytics({
  query: queryParts,
  index,
  queryType,
  aggregatesTableResult,
  spansTableResult,
  timeseriesResult,
  interval,
  isTopN,
}: Pick<
  UseTrackAnalyticsProps,
  | 'queryType'
  | 'aggregatesTableResult'
  | 'spansTableResult'
  | 'timeseriesResult'
  | 'interval'
  | 'isTopN'
> & {
  index: number;
  query: ReadableExploreQueryParts;
}) {
  const dataset = DiscoverDatasets.SPANS_EAP_RPC;
  const query = queryParts.query;
  const fields = queryParts.fields;
  const visualizes = queryParts.yAxes.map(
    yAxis => new Visualize(yAxis, {label: String(index), chartType: queryParts.chartType})
  );

  return useTrackAnalytics({
    queryType,
    aggregatesTableResult,
    spansTableResult,
    timeseriesResult,
    dataset,
    query,
    fields,
    visualizes,
    interval,
    page_source: 'compare',
    isTopN,
  });
}

export function useLogAnalytics({
  logsTableResult,
  source,
}: {
  logsTableResult: UseLogsQueryResult | UseInfiniteLogsQueryResult;
  source: LogsAnalyticsPageSource;
}) {
  const organization = useOrganization();

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();

  const dataset = DiscoverDatasets.OURLOGS;
  const search = useLogsSearch();
  const query = search.formatString();
  const fields = useLogsFields();
  const page_source = source;

  const tableError = logsTableResult.error?.message ?? '';
  const query_status = tableError ? 'error' : 'success';

  useEffect(() => {
    if (logsTableResult.isPending || isLoadingSubscriptionDetails) {
      return;
    }

    const columns = fields as unknown as string[];
    trackAnalytics('logs.explorer.metadata', {
      organization,
      dataset,
      columns,
      columns_count: columns.length,
      query_status,
      table_result_length: logsTableResult.data?.length || 0,
      table_result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
    });

    info(
      fmt`log.explorer.metadata:
      organization: ${organization.slug}
      dataset: ${dataset}
      query: ${query}
      fields: ${fields}
      query_status: ${query_status}
      result_length: ${String(logsTableResult.data?.length || 0)}
      user_queries: ${search.formatString()}
      user_queries_count: ${String(search.tokens.length)}
      has_exceeded_performance_usage_limit: ${String(hasExceededPerformanceUsageLimit)}
      page_source: ${page_source}
    `,
      {isAnalytics: true}
    );
  }, [
    organization,
    dataset,
    fields,
    query,
    hasExceededPerformanceUsageLimit,
    isLoadingSubscriptionDetails,
    query_status,
    page_source,
    logsTableResult.isPending,
    logsTableResult.data?.length,
    search,
  ]);
}

function computeConfidence(
  visualizes: Visualize[],
  data: ReturnType<typeof useSortedTimeSeries>['data']
) {
  return visualizes.map(visualize => {
    const dedupedYAxes = [visualize.yAxis];
    const series = dedupedYAxes.flatMap(yAxis => data[yAxis]).filter(defined);
    return String(combineConfidenceForSeries(series));
  });
}

function computeEmptyBucketsForSeries(series: Pick<TimeSeries, 'values'>): number {
  let emptyBucketsForSeries = 0;
  for (const item of series.values) {
    if (item.value === 0 || item.value === null) {
      emptyBucketsForSeries += 1;
    }
  }
  return Math.floor((emptyBucketsForSeries / series.values.length) * 100);
}

function computeEmptyBuckets(
  visualizes: Visualize[],
  data: ReturnType<typeof useSortedTimeSeries>['data']
) {
  return visualizes.flatMap(visualize => {
    const dedupedYAxes = [visualize.yAxis];
    return dedupedYAxes
      .flatMap(yAxis => data[yAxis])
      .filter(defined)
      .map(computeEmptyBucketsForSeries);
  });
}
