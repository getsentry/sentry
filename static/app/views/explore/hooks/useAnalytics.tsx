import {useEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
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
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
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

  const {setupAcknowledgement: seerSetup, isLoading: isLoadingSeerSetup} =
    useOrganizationSeerSetup({
      enabled: !organization.hideAiFeatures,
    });

  useEffect(() => {
    if (
      queryType !== 'aggregate' ||
      aggregatesTableResult.result.isPending ||
      timeseriesResult.isPending ||
      isLoadingSubscriptionDetails ||
      isLoadingSeerSetup
    ) {
      return;
    }

    const search = new MutableSearch(query);
    const columns = aggregatesTableResult.eventView.getColumns() as unknown as string[];
    const gaveSeerConsent = organization.hideAiFeatures
      ? 'gen_ai_features_disabled'
      : seerSetup?.orgHasAcknowledged
        ? 'given'
        : 'not_given';

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
      gave_seer_consent: gaveSeerConsent,
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
      gave_seer_consent: ${gaveSeerConsent}
    `,
      {isAnalytics: true}
    );
    /* eslint-enable @typescript-eslint/no-base-to-string */
  }, [
    aggregatesTableResult.eventView,
    aggregatesTableResult.result.data?.length,
    aggregatesTableResult.result.isPending,
    dataset,
    hasExceededPerformanceUsageLimit,
    interval,
    isLoadingSeerSetup,
    isLoadingSubscriptionDetails,
    isTopN,
    organization,
    page_source,
    query,
    queryType,
    query_status,
    seerSetup?.orgHasAcknowledged,
    timeseriesResult.data,
    timeseriesResult.isPending,
    title,
    visualizes,
  ]);

  useEffect(() => {
    if (
      queryType !== 'samples' ||
      spansTableResult.result.isPending ||
      timeseriesResult.isPending ||
      isLoadingSubscriptionDetails ||
      isLoadingSeerSetup
    ) {
      return;
    }

    const search = new MutableSearch(query);
    const gaveSeerConsent = organization.hideAiFeatures
      ? 'gen_ai_features_disabled'
      : seerSetup?.orgHasAcknowledged
        ? 'given'
        : 'not_given';

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
      gave_seer_consent: gaveSeerConsent,
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
      gave_seer_consent: ${gaveSeerConsent}
    `);
  }, [
    dataset,
    fields,
    hasExceededPerformanceUsageLimit,
    interval,
    isLoadingSeerSetup,
    isLoadingSubscriptionDetails,
    isTopN,
    organization,
    page_source,
    query,
    queryType,
    query_status,
    seerSetup?.orgHasAcknowledged,
    spansTableResult.result.data?.length,
    spansTableResult.result.isPending,
    timeseriesResult.data,
    timeseriesResult.isPending,
    title,
    visualizes,
  ]);

  const tracesTableResultDefined = defined(tracesTableResult);

  useEffect(() => {
    if (
      !tracesTableResultDefined ||
      queryType !== 'traces' ||
      tracesTableResult.result.isPending ||
      timeseriesResult.isPending ||
      isLoadingSubscriptionDetails ||
      isLoadingSeerSetup
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
    const gaveSeerConsent = organization.hideAiFeatures
      ? 'gen_ai_features_disabled'
      : seerSetup?.orgHasAcknowledged
        ? 'given'
        : 'not_given';

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
      gave_seer_consent: gaveSeerConsent,
    });
  }, [
    dataset,
    hasExceededPerformanceUsageLimit,
    interval,
    isLoadingSeerSetup,
    isLoadingSubscriptionDetails,
    isTopN,
    organization,
    page_source,
    query,
    queryType,
    query_status,
    seerSetup?.orgHasAcknowledged,
    timeseriesResult.data,
    timeseriesResult.isPending,
    title,
    tracesTableResult?.result.data?.data,
    tracesTableResult?.result.isPending,
    tracesTableResultDefined,
    visualizes,
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
  query: ReadableExploreQueryParts;
}) {
  const dataset = DiscoverDatasets.SPANS;
  const query = queryParts.query;
  const fields = queryParts.fields;
  const visualizes = queryParts.yAxes.map(
    yAxis => new Visualize(yAxis, {chartType: queryParts.chartType})
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
  logsTableResult: UseInfiniteLogsQueryResult;
  source: LogsAnalyticsPageSource;
}) {
  const organization = useOrganization();

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails();

  const dataset = DiscoverDatasets.OURLOGS;
  const dataScanned = logsTableResult.meta?.dataScanned ?? '';
  const search = useLogsSearch();
  const query = search.formatString();
  const fields = useLogsFields();
  const page_source = source;

  const tableError = logsTableResult.error?.message ?? '';
  const query_status = tableError ? 'error' : 'success';
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const autorefreshBox = useRef(autorefreshEnabled); // Boxed to avoid useEffect firing analytics on changes.
  const resultLengthBox = useRef(logsTableResult.data?.length || 0); // Boxed to avoid useEffect firing analytics on changes.
  const isDisablingAutorefresh = useRef(false);

  autorefreshBox.current = autorefreshEnabled;
  resultLengthBox.current = logsTableResult.data?.length || 0;

  useEffect(() => {
    if (!autorefreshEnabled) {
      isDisablingAutorefresh.current = true;
    }
  }, [autorefreshEnabled]);

  useEffect(() => {
    if (isDisablingAutorefresh.current) {
      isDisablingAutorefresh.current = false;
      return;
    }

    if (
      logsTableResult.isPending ||
      isLoadingSubscriptionDetails ||
      autorefreshBox.current
    ) {
      // Auto-refresh causes constant metadata events, so we don't want to track them.
      return;
    }

    const columns = fields as unknown as string[];
    trackAnalytics('logs.explorer.metadata', {
      organization,
      dataset,
      dataScanned,
      columns,
      columns_count: columns.length,
      query_status,
      table_result_length: resultLengthBox.current,
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
      result_length: ${String(resultLengthBox.current)}
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
    dataScanned,
    fields,
    query,
    hasExceededPerformanceUsageLimit,
    isLoadingSubscriptionDetails,
    query_status,
    page_source,
    logsTableResult.isPending,
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
