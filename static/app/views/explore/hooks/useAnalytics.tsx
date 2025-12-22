import {useEffect, useEffectEvent, useMemo, useRef, type RefObject} from 'react';
import * as Sentry from '@sentry/react';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {useChartSelection} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {getTitleFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/title';
import {useCrossEventQueries} from 'sentry/views/explore/hooks/useCrossEventQueries';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TracesTableResult} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {type useLogsAggregatesTable} from 'sentry/views/explore/logs/useLogsAggregatesTable';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {isEmptyTraceMetric} from 'sentry/views/explore/metrics/utils';
import type {ReadableExploreQueryParts} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsSearch,
  useQueryParamsTitle,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {
  combineConfidenceForSeries,
  computeVisualizeSampleTotals,
} from 'sentry/views/explore/utils';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {usePerformanceSubscriptionDetails} from 'sentry/views/performance/newTraceDetails/traceTypeWarnings/usePerformanceSubscriptionDetails';

const {info, fmt} = Sentry.logger;

type QueryType = 'aggregate' | 'samples' | 'traces' | 'attribute_breakdowns';

interface UseTrackAnalyticsProps {
  aggregatesTableResult: AggregatesTableResult;
  dataset: DiscoverDatasets;
  fields: readonly string[];
  interval: string;
  isTopN: boolean;
  page_source: 'explore' | 'compare';
  query: string;
  queryType: QueryType;
  spansTableResult: SpansTableResult;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  visualizes: readonly Visualize[];
  attributeBreakdownsMode?: 'breakdowns' | 'cohort_comparison';
  title?: string;
  tracesTableResult?: TracesTableResult;
}

function useTrackAnalytics({
  attributeBreakdownsMode,
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
  const crossEventQueries = useCrossEventQueries();

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails({traceItemDataset: 'default'});

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

    const dataScanned = aggregatesTableResult.result.meta?.dataScanned ?? '';
    const yAxes = visualizes.map(visualize => visualize.yAxis);

    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataScanned,
      dataset,
      result_mode: 'aggregates',
      columns,
      columns_count: columns.length,
      query_status,
      result_length: aggregatesTableResult.result.data?.length || 0,
      result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes: visualizes.map(visualize => visualize.serialize()),
      visualizes_count: visualizes.length,
      title: title || '',
      empty_buckets_percentage: computeEmptyBuckets(yAxes, timeseriesResult.data),
      confidences: computeConfidence(yAxes, timeseriesResult.data),
      sample_counts: computeVisualizeSampleTotals(yAxes, timeseriesResult.data, isTopN),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
      interval,
      gave_seer_consent: gaveSeerConsent,
      version: 2,
      cross_event_log_query_count: crossEventQueries?.logQuery?.length ?? 0,
      cross_event_metric_query_count: crossEventQueries?.metricQuery?.length ?? 0,
      cross_event_span_query_count: crossEventQueries?.spanQuery?.length ?? 0,
    });

    /* eslint-disable @typescript-eslint/no-base-to-string */
    info(
      fmt`trace.explorer.metadata:
      organization: ${organization.slug}
      dataScanned: ${dataScanned}
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
      cross_event_log_query_count: ${crossEventQueries?.logQuery?.length ?? 0}
      cross_event_metric_query_count: ${crossEventQueries?.metricQuery?.length ?? 0}
      cross_event_span_query_count: ${crossEventQueries?.spanQuery?.length ?? 0}
    `,
      {isAnalytics: true}
    );
    /* eslint-enable @typescript-eslint/no-base-to-string */
  }, [
    aggregatesTableResult.eventView,
    aggregatesTableResult.result.data?.length,
    aggregatesTableResult.result.isPending,
    aggregatesTableResult.result.meta?.dataScanned,
    crossEventQueries?.logQuery,
    crossEventQueries?.metricQuery,
    crossEventQueries?.spanQuery,
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

    const dataScanned = spansTableResult.result.meta?.dataScanned ?? '';
    const yAxes = visualizes.map(visualize => visualize.yAxis);

    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataScanned,
      dataset,
      result_mode: 'span samples',
      columns: fields,
      columns_count: fields.length,
      query_status,
      result_length: spansTableResult.result.data?.length || 0,
      result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes: visualizes.map(visualize => visualize.serialize()),
      visualizes_count: visualizes.length,
      title: title || '',
      empty_buckets_percentage: computeEmptyBuckets(yAxes, timeseriesResult.data),
      confidences: computeConfidence(yAxes, timeseriesResult.data),
      sample_counts: computeVisualizeSampleTotals(yAxes, timeseriesResult.data, isTopN),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
      interval,
      gave_seer_consent: gaveSeerConsent,
      version: 2,
      attribute_breakdowns_mode: attributeBreakdownsMode,
      cross_event_log_query_count: crossEventQueries?.logQuery?.length ?? 0,
      cross_event_metric_query_count: crossEventQueries?.metricQuery?.length ?? 0,
      cross_event_span_query_count: crossEventQueries?.spanQuery?.length ?? 0,
    });

    info(fmt`trace.explorer.metadata:
      organization: ${organization.slug}
      dataScanned: ${dataScanned}
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
      attribute_breakdowns_mode: ${attributeBreakdownsMode}
      cross_event_log_query_count: ${crossEventQueries?.logQuery?.length ?? 0}
      cross_event_metric_query_count: ${crossEventQueries?.metricQuery?.length ?? 0}
      cross_event_span_query_count: ${crossEventQueries?.spanQuery?.length ?? 0}
    `);
  }, [
    attributeBreakdownsMode,
    crossEventQueries?.logQuery,
    crossEventQueries?.metricQuery,
    crossEventQueries?.spanQuery,
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
    spansTableResult.result.meta?.dataScanned,
    timeseriesResult.data,
    timeseriesResult.isPending,
    title,
    visualizes,
  ]);

  useEffect(() => {
    if (
      queryType !== 'attribute_breakdowns' ||
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

    const yAxes = visualizes.map(visualize => visualize.yAxis);

    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataScanned: '',
      dataset,
      result_mode: 'attribute breakdowns',
      columns: [],
      columns_count: 0,
      query_status,
      result_length: 0,
      result_missing_root: 0,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes: visualizes.map(visualize => visualize.serialize()),
      visualizes_count: visualizes.length,
      title: title || '',
      empty_buckets_percentage: computeEmptyBuckets(yAxes, timeseriesResult.data),
      confidences: computeConfidence(yAxes, timeseriesResult.data),
      sample_counts: computeVisualizeSampleTotals(yAxes, timeseriesResult.data, isTopN),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
      interval,
      gave_seer_consent: gaveSeerConsent,
      version: 2,
      attribute_breakdowns_mode: attributeBreakdownsMode,
      cross_event_log_query_count: crossEventQueries?.logQuery?.length ?? 0,
      cross_event_metric_query_count: crossEventQueries?.metricQuery?.length ?? 0,
      cross_event_span_query_count: crossEventQueries?.spanQuery?.length ?? 0,
    });

    info(fmt`trace.explorer.metadata:
      organization: ${organization.slug}
      dataScanned: ''
      dataset: ${dataset}
      query: ${query}
      visualizes: ${visualizes.map(v => v.chartType).join(', ')}
      title: ${title || ''}
      queryType: ${queryType}
      result_length: ''
      user_queries: ${search.formatString()}
      user_queries_count: ${String(search.tokens.length)}
      visualizes_count: ${String(visualizes.length)}
      has_exceeded_performance_usage_limit: ${String(hasExceededPerformanceUsageLimit)}
      page_source: ${page_source}
      gave_seer_consent: ${gaveSeerConsent}
      attribute_breakdowns_mode: ${attributeBreakdownsMode}
      cross_event_log_query_count: ${crossEventQueries?.logQuery?.length ?? 0}
      cross_event_metric_query_count: ${crossEventQueries?.metricQuery?.length ?? 0}
      cross_event_span_query_count: ${crossEventQueries?.spanQuery?.length ?? 0}
    `);
  }, [
    attributeBreakdownsMode,
    crossEventQueries?.logQuery,
    crossEventQueries?.metricQuery,
    crossEventQueries?.spanQuery,
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

    const yAxes = visualizes.map(visualize => visualize.yAxis);

    trackAnalytics('trace.explorer.metadata', {
      organization,
      dataScanned: '',
      dataset,
      result_mode: 'trace samples',
      columns,
      columns_count: columns.length,
      query_status,
      result_length: tracesTableResult.result.data?.data?.length || 0,
      result_missing_root: resultMissingRoot,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      visualizes: visualizes.map(visualize => visualize.serialize()),
      visualizes_count: visualizes.length,
      title: title || '',
      empty_buckets_percentage: computeEmptyBuckets(yAxes, timeseriesResult.data),
      confidences: computeConfidence(yAxes, timeseriesResult.data),
      sample_counts: computeVisualizeSampleTotals(yAxes, timeseriesResult.data, isTopN),
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
      interval,
      gave_seer_consent: gaveSeerConsent,
      version: 2,
      cross_event_log_query_count: crossEventQueries?.logQuery?.length ?? 0,
      cross_event_metric_query_count: crossEventQueries?.metricQuery?.length ?? 0,
      cross_event_span_query_count: crossEventQueries?.spanQuery?.length ?? 0,
    });
  }, [
    crossEventQueries?.logQuery,
    crossEventQueries?.metricQuery,
    crossEventQueries?.spanQuery,
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
  const dataset = useSpansDataset();
  const title = useQueryParamsTitle();
  const query = useQueryParamsQuery();
  const fields = useQueryParamsFields();
  const visualizes = useQueryParamsVisualizes();
  const topEvents = useTopEvents();
  const isTopN = topEvents ? topEvents > 0 : false;
  const {chartSelection} = useChartSelection();

  const attributeBreakdownsMode =
    queryType === 'attribute_breakdowns'
      ? chartSelection
        ? 'cohort_comparison'
        : 'breakdowns'
      : undefined;

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
    attributeBreakdownsMode,
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
  const visualizes = queryParts.yAxes.flatMap(yAxis =>
    Visualize.fromJSON({
      yAxes: [yAxis],
      chartType: queryParts.chartType,
    })
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
  interval,
  isTopN,
  logsAggregatesTableResult,
  logsTableResult,
  logsTimeseriesResult,
  mode,
  source,
  yAxes,
  sortBys,
  aggregateSortBys,
}: {
  aggregateSortBys: readonly Sort[];
  interval: string;
  isTopN: boolean;
  logsAggregatesTableResult: ReturnType<typeof useLogsAggregatesTable>;
  logsTableResult: UseInfiniteLogsQueryResult;
  logsTimeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  mode: Mode;
  sortBys: readonly Sort[];
  source: LogsAnalyticsPageSource;
  yAxes: string[];
}) {
  const organization = useOrganization();
  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails({traceItemDataset: 'logs'});

  const dataset = DiscoverDatasets.OURLOGS;
  const dataScanned = logsTableResult.meta?.dataScanned ?? '';
  const search = useQueryParamsSearch();
  const query = useQueryParamsQuery();
  const fields = useQueryParamsFields();
  const page_source = source;

  const tableError = logsTableResult.error?.message ?? '';
  const query_status = tableError ? 'error' : 'success';
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const autorefreshBox = useBox(autorefreshEnabled); // Boxed to avoid useEffect firing analytics on changes.
  const aggregatesResultLengthBox = useBox(
    logsAggregatesTableResult.data?.data?.length || 0
  ); // Boxed to avoid useEffect firing analytics on changes.
  const resultLengthBox = useBox(logsTableResult.data?.length || 0); // Boxed to avoid useEffect firing analytics on changes.
  const fieldsBox = useBox(fields);
  const yAxesBox = useBox(yAxes); // Boxed to avoid useEffect firing analytics on change
  const sortBysBox = useBox(sortBys.map(formatSort)); // Boxed to avoid useEffect firing analytics on change
  const aggregateSortBysBox = useBox(aggregateSortBys.map(formatSort)); // Boxed to avoid useEffect firing analytics on change

  const timeseriesData = useBox(logsTimeseriesResult.data);

  const isDisablingAutorefresh = useRef(false);

  useEffect(() => {
    if (!autorefreshEnabled) {
      isDisablingAutorefresh.current = true;
    }
  }, [autorefreshEnabled]);

  useEffect(() => {
    if (mode !== Mode.SAMPLES) {
      return;
    }

    if (isDisablingAutorefresh.current) {
      isDisablingAutorefresh.current = false;
      return;
    }

    if (
      logsTableResult.isPending ||
      logsTimeseriesResult.isPending ||
      isLoadingSubscriptionDetails ||
      autorefreshBox.current
    ) {
      // Auto-refresh causes constant metadata events, so we don't want to track them.
      return;
    }

    trackAnalytics('logs.explorer.metadata', {
      organization,
      dataset,
      dataScanned,
      columns: fieldsBox.current,
      columns_count: fieldsBox.current.length,
      confidences: computeConfidence(yAxesBox.current, timeseriesData.current),
      empty_buckets_percentage: computeEmptyBuckets(
        yAxesBox.current,
        timeseriesData.current
      ),
      interval,
      query_status,
      sample_counts: computeVisualizeSampleTotals(
        yAxesBox.current,
        timeseriesData.current,
        isTopN
      ),
      table_result_length: resultLengthBox.current,
      table_result_missing_root: 0,
      table_result_mode: 'log samples',
      table_result_sort: sortBysBox.current,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
    });

    info(
      fmt`log.explorer.metadata:
      organization: ${organization.slug}
      dataScanned: ${dataScanned}
      dataset: ${dataset}
      query: ${query}
      fields: ${fieldsBox.current}
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
    autorefreshBox,
    dataScanned,
    query,
    fieldsBox,
    hasExceededPerformanceUsageLimit,
    interval,
    isLoadingSubscriptionDetails,
    query_status,
    isTopN,
    page_source,
    logsTableResult.isPending,
    search,
    timeseriesData,
    logsTimeseriesResult.isPending,
    mode,
    resultLengthBox,
    sortBysBox,
    yAxesBox,
  ]);

  useEffect(() => {
    if (mode !== Mode.AGGREGATE) {
      return;
    }

    if (
      logsAggregatesTableResult.isPending ||
      logsTimeseriesResult.isPending ||
      isLoadingSubscriptionDetails ||
      autorefreshBox.current
    ) {
      // Auto-refresh causes constant metadata events, so we don't want to track them.
      return;
    }

    trackAnalytics('logs.explorer.metadata', {
      organization,
      dataset,
      dataScanned,
      columns: fieldsBox.current,
      columns_count: fieldsBox.current.length,
      confidences: computeConfidence(yAxes, timeseriesData.current),
      empty_buckets_percentage: computeEmptyBuckets(yAxes, timeseriesData.current),
      interval,
      query_status,
      sample_counts: computeVisualizeSampleTotals(yAxes, timeseriesData.current, isTopN),
      table_result_length: aggregatesResultLengthBox.current,
      table_result_missing_root: 0,
      table_result_mode: 'aggregates',
      table_result_sort: aggregateSortBysBox.current,
      user_queries: search.formatString(),
      user_queries_count: search.tokens.length,
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      page_source,
    });

    info(
      fmt`log.explorer.metadata:
      organization: ${organization.slug}
      dataScanned: ${dataScanned}
      dataset: ${dataset}
      query: ${query}
      fields: ${fieldsBox.current}
      query_status: ${query_status}
      result_length: ${String(aggregatesResultLengthBox.current)}
      user_queries: ${search.formatString()}
      user_queries_count: ${String(search.tokens.length)}
      has_exceeded_performance_usage_limit: ${String(hasExceededPerformanceUsageLimit)}
      page_source: ${page_source}
    `,
      {isAnalytics: true}
    );
  }, [
    aggregateSortBysBox,
    aggregatesResultLengthBox,
    autorefreshBox,
    dataScanned,
    dataset,
    fieldsBox,
    hasExceededPerformanceUsageLimit,
    interval,
    isLoadingSubscriptionDetails,
    isTopN,
    logsAggregatesTableResult.isPending,
    timeseriesData,
    logsTimeseriesResult.isPending,
    mode,
    organization,
    page_source,
    query,
    query_status,
    search,
    yAxes,
  ]);
}

function computeConfidence(
  yAxes: string[],
  data: ReturnType<typeof useSortedTimeSeries>['data']
) {
  return yAxes.map(yAxis => {
    const series = data[yAxis]?.filter(defined) ?? [];
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
  yAxes: string[],
  data: ReturnType<typeof useSortedTimeSeries>['data']
) {
  return yAxes.flatMap(yAxis => {
    const series = data?.[yAxis]?.filter(defined) ?? [];
    return series.map(computeEmptyBucketsForSeries);
  });
}

export function useMetricsPanelAnalytics({
  interval,
  isTopN,
  metricAggregatesTableResult,
  metricSamplesTableResult,
  metricTimeseriesResult,
  mode,
  traceMetric,
  sortBys,
  aggregateSortBys,
  panelIndex,
}: {
  aggregateSortBys: readonly Sort[];
  interval: string;
  isTopN: boolean;
  metricAggregatesTableResult: ReturnType<typeof useMetricAggregatesTable>;
  metricSamplesTableResult: ReturnType<typeof useMetricSamplesTable>;
  metricTimeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  mode: Mode;
  sortBys: readonly Sort[];
  traceMetric: TraceMetric;
  panelIndex?: number;
}) {
  const organization = useOrganization();

  const dataset = DiscoverDatasets.METRICS;
  const dataScanned =
    mode === Mode.AGGREGATE
      ? (metricAggregatesTableResult.result.meta?.dataScanned ?? '')
      : (metricSamplesTableResult.result.meta?.dataScanned ?? '');
  const search = useQueryParamsSearch();
  const query = useQueryParamsQuery();
  const groupBys = useQueryParamsGroupBys();
  const visualize = useMetricVisualize();
  const aggregateFunctionBox = useBox(visualize.parsedFunction?.name ?? '');

  const tableError =
    mode === Mode.AGGREGATE
      ? (metricAggregatesTableResult.result.error?.message ?? '')
      : (metricSamplesTableResult.error?.message ?? '');
  const query_status = tableError ? 'error' : 'success';

  const aggregatesResultLengthBox = useBox(
    metricAggregatesTableResult.result.data?.length || 0
  );
  const resultLengthBox = useBox(metricSamplesTableResult.result.data?.length || 0);
  const formattedSortBysBox = useBox(
    useMemo(() => JSON.stringify(sortBys.map(formatSort)), [sortBys])
  );
  const formattedAggregateSortBysBox = useBox(
    useMemo(() => JSON.stringify(aggregateSortBys.map(formatSort)), [aggregateSortBys])
  );
  const timeseriesDataBox = useBox(metricTimeseriesResult.data);
  const searchStringBox = useBox(useMemo(() => search.formatString(), [search]));
  const searchTokensLengthBox = useBox(useMemo(() => search.tokens.length, [search]));
  const groupBysBox = useBox(groupBys);
  const dataScannedBox = useBox(dataScanned);
  const metricNameBox = useBox(traceMetric.name);
  const metricTypeBox = useBox(traceMetric.type);

  const intervalBox = useBox(interval);
  const queryStatusBox = useBox(query_status);
  const isTopNBox = useBox(isTopN);

  const getAttributes = useEffectEvent((resultMode: 'metric samples' | 'aggregates') => {
    return {
      dataset,
      metric_name: metricNameBox.current,
      metric_type: metricTypeBox.current,
      dataScanned: dataScannedBox.current,
      group_bys: groupBysBox.current,
      confidences: computeConfidence([metricNameBox.current], timeseriesDataBox.current),
      empty_buckets_percentage: computeEmptyBuckets(
        [metricNameBox.current],
        timeseriesDataBox.current
      ),
      table_result_length: resultLengthBox.current,
      table_result_mode: resultMode,
      table_result_sort: JSON.parse(formattedSortBysBox.current),
      user_queries: searchStringBox.current,
      user_queries_count: searchTokensLengthBox.current,
      panel_index: panelIndex,
      aggregate_function: aggregateFunctionBox.current,
      interval: intervalBox.current,
      query_status: queryStatusBox.current as 'pending' | 'error' | 'success',
      sample_counts: computeVisualizeSampleTotals(
        [metricNameBox.current],
        timeseriesDataBox.current,
        isTopNBox.current
      ),
    };
  });

  useEffect(() => {
    if (
      mode !== Mode.SAMPLES ||
      metricSamplesTableResult.result.isFetching ||
      metricTimeseriesResult.isPending ||
      !dataScannedBox.current ||
      !metricNameBox.current
    ) {
      return;
    }
    const attributes = getAttributes('metric samples');

    trackAnalytics('metrics.explorer.panel.metadata', {...attributes, organization});
    info('metric.explorer.panel.metadata', {...attributes, isAnalytics: true});
  }, [
    organization,
    dataset,
    mode,
    metricSamplesTableResult.result.isFetching,
    metricTimeseriesResult.isPending,
    panelIndex,
    dataScannedBox,
    intervalBox,
    queryStatusBox,
    isTopNBox,
    resultLengthBox,
    formattedSortBysBox,
    metricNameBox,
    timeseriesDataBox,
    searchStringBox,
    searchTokensLengthBox,
    query_status,
    query,
    aggregateFunctionBox,
    groupBysBox,
    metricTypeBox,
  ]);

  useEffect(() => {
    if (
      mode !== Mode.AGGREGATE ||
      metricAggregatesTableResult.result.isPending ||
      metricTimeseriesResult.isPending ||
      !dataScannedBox.current ||
      !metricNameBox.current
    ) {
      return;
    }

    const attributes = getAttributes('aggregates');
    trackAnalytics('metrics.explorer.panel.metadata', {...attributes, organization});
    info('metric.explorer.panel.metadata', {...attributes, isAnalytics: true});
  }, [
    organization,
    dataset,
    mode,
    metricAggregatesTableResult.result.isPending,
    metricTimeseriesResult.isPending,
    panelIndex,
    formattedAggregateSortBysBox,
    aggregatesResultLengthBox,
    dataScannedBox,
    intervalBox,
    isTopNBox,
    timeseriesDataBox,
    queryStatusBox,
    searchStringBox,
    searchTokensLengthBox,
    metricNameBox,
    query,
    query_status,
  ]);
}

export function useMetricsAnalytics({
  interval,
  metricQueries,
  areToolbarsLoading,
  isMetricOptionsEmpty,
}: {
  areToolbarsLoading: boolean;
  interval: string;
  isMetricOptionsEmpty: boolean;
  metricQueries: Array<{metric: TraceMetric; queryParams: ReadableQueryParams}>;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const title = getTitleFromLocation(location);

  const {
    data: {hasExceededPerformanceUsageLimit},
    isLoading: isLoadingSubscriptionDetails,
  } = usePerformanceSubscriptionDetails({traceItemDataset: 'default'});

  const queries = metricQueries.map(mq => mq.metric);

  const nonEmptyMetricQueries = useMemo(
    () => queries.filter(q => !isEmptyTraceMetric(q)),
    [queries]
  );

  const metricPanelsWithGroupBys = metricQueries
    .filter(mq => !isEmptyTraceMetric(mq.metric))
    .filter(mq =>
      mq.queryParams.groupBys.some((gb: string) => gb.trim().length > 0)
    ).length;
  const metricPanelsWithFilters = metricQueries
    .filter(mq => !isEmptyTraceMetric(mq.metric))
    .filter(mq => mq.queryParams.query.trim().length > 0).length;

  useEffect(() => {
    if (isLoadingSubscriptionDetails || areToolbarsLoading) {
      return;
    }

    if (nonEmptyMetricQueries.length === 0 && !isMetricOptionsEmpty) {
      return;
    }

    const datetimeSelection = `${selection.datetime.start || ''}-${selection.datetime.end || ''}-${selection.datetime.period || ''}`;
    const projectCount = selection.projects.length;
    const environmentCount = selection.environments.length;

    trackAnalytics('metrics.explorer.metadata', {
      organization,
      datetime_selection: datetimeSelection,
      environment_count: environmentCount,
      has_exceeded_performance_usage_limit: hasExceededPerformanceUsageLimit,
      interval,
      metric_panels_with_filters_count: metricPanelsWithFilters,
      metric_panels_with_group_bys_count: metricPanelsWithGroupBys,
      metric_queries_count: nonEmptyMetricQueries.length,
      project_count: projectCount,
      title: title || '',
    });

    info(
      fmt`metrics.explorer.metadata:
      organization: ${organization.slug}
      datetime_selection: ${datetimeSelection}
      environment_count: ${String(environmentCount)}
      interval: ${interval}
      metric_queries_count: ${String(metricQueries.length)}
      metric_panels_with_group_bys_count: ${String(metricPanelsWithGroupBys)}
      metric_panels_with_filters_count: ${String(metricPanelsWithFilters)}
      project_count: ${String(projectCount)}
      has_exceeded_performance_usage_limit: ${String(hasExceededPerformanceUsageLimit)}
    `,
      {isAnalytics: true}
    );
  }, [
    areToolbarsLoading,
    title,
    hasExceededPerformanceUsageLimit,
    interval,
    isLoadingSubscriptionDetails,
    nonEmptyMetricQueries.length,
    metricPanelsWithGroupBys,
    metricPanelsWithFilters,
    organization,
    isMetricOptionsEmpty,
    selection.datetime.end,
    selection.datetime.period,
    selection.datetime.start,
    selection.environments.length,
    selection.projects.length,
    metricQueries.length,
  ]);
}

function useBox<T>(value: T): RefObject<T> {
  const box = useRef(value);
  box.current = value;
  return box;
}
