import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {computeAxisMax} from 'sentry/views/insights/common/components/chart';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {AverageValueMarkLine} from 'sentry/views/insights/common/utils/averageValueMarkLine';
import {useSampleScatterPlotSeries} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';
import {DurationChartWithSamples} from 'sentry/views/insights/http/components/charts/durationChartWithSamples';
import {useSpanSamples} from 'sentry/views/insights/http/queries/useSpanSamples';
import {useDebouncedState} from 'sentry/views/insights/http/utils/useDebouncedState';
import {MessageSpanSamplesTable} from 'sentry/views/insights/queues/components/tables/messageSpanSamplesTable';
import {useQueuesMetricsQuery} from 'sentry/views/insights/queues/queries/useQueuesMetricsQuery';
import {Referrer} from 'sentry/views/insights/queues/referrers';
import {
  CONSUMER_QUERY_FILTER,
  MessageActorType,
  PRODUCER_QUERY_FILTER,
  RETRY_COUNT_OPTIONS,
  TRACE_STATUS_OPTIONS,
} from 'sentry/views/insights/queues/settings';
import decodeRetryCount from 'sentry/views/insights/queues/utils/queryParameterDecoders/retryCount';
import decodeTraceStatus from 'sentry/views/insights/queues/utils/queryParameterDecoders/traceStatus';
import {
  ModuleName,
  SpanIndexedField,
  type SpanMetricsResponse,
} from 'sentry/views/insights/types';

import {SampleDrawerBody} from '../../common/components/sampleDrawerBody';
import {SampleDrawerHeaderTransaction} from '../../common/components/sampleDrawerHeaderTransaction';

export function MessageSpanSamplesPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      destination: decodeScalar,
      transaction: decodeScalar,
      retryCount: decodeRetryCount,
      traceStatus: decodeTraceStatus,
      spanSearchQuery: decodeScalar,
      'span.op': decodeScalar,
    },
  });
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const project = projects.find(p => query.project === p.id);

  const organization = useOrganization();

  const [highlightedSpanId, setHighlightedSpanId] = useDebouncedState<string | undefined>(
    undefined,
    [],
    SAMPLE_HOVER_DEBOUNCE
  );

  // `detailKey` controls whether the panel is open. If all required properties are available, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey = query.transaction
    ? [query.destination, query.transaction].filter(Boolean).join(':')
    : undefined;

  const handleTraceStatusChange = (newTraceStatus: SelectOption<string>) => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'trace_status',
      new_state: newTraceStatus.value,
      organization,
      source: ModuleName.QUEUE,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        traceStatus: newTraceStatus.value,
      },
    });
  };

  const handleRetryCountChange = (newRetryCount: SelectOption<string>) => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'retry_count',
      new_state: newRetryCount.value,
      organization,
      source: ModuleName.QUEUE,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        retryCount: newRetryCount.value,
      },
    });
  };

  const isPanelOpen = Boolean(detailKey);

  const messageActorType =
    query['span.op'] === 'queue.publish'
      ? MessageActorType.PRODUCER
      : MessageActorType.CONSUMER;
  const queryFilter =
    messageActorType === MessageActorType.PRODUCER
      ? PRODUCER_QUERY_FILTER
      : CONSUMER_QUERY_FILTER;

  const timeseriesFilters = new MutableSearch(queryFilter);
  timeseriesFilters.addFilterValue('transaction', query.transaction);
  timeseriesFilters.addFilterValue('messaging.destination.name', query.destination);

  const sampleFilters = new MutableSearch(queryFilter);
  sampleFilters.addFilterValue('transaction', query.transaction);
  sampleFilters.addFilterValue('messaging.destination.name', query.destination);

  // filter by key-value filters specified in the search bar query
  sampleFilters.addStringMultiFilter(query.spanSearchQuery);

  if (query.traceStatus.length > 0) {
    sampleFilters.addFilterValue('trace.status', query.traceStatus);
  }

  // Note: only consumer panels should allow filtering by retry count
  if (messageActorType === MessageActorType.CONSUMER) {
    if (query.retryCount === '0') {
      sampleFilters.addFilterValue('measurements.messaging.message.retry.count', '0');
    } else if (query.retryCount === '1-3') {
      sampleFilters.addFilterValues('measurements.messaging.message.retry.count', [
        '>=1',
        '<=3',
      ]);
    } else if (query.retryCount === '4+') {
      sampleFilters.addFilterValue('measurements.messaging.message.retry.count', '>=4');
    }
  }

  const {data: transactionMetrics, isFetching: aretransactionMetricsFetching} =
    useQueuesMetricsQuery({
      destination: query.destination,
      transaction: query.transaction,
      enabled: isPanelOpen,
      referrer: Referrer.QUEUES_SAMPLES_PANEL,
    });

  const avg = transactionMetrics?.[0]?.['avg(span.duration)'];

  const {
    isFetching: isDurationDataFetching,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries(
    {
      search: timeseriesFilters,
      yAxis: [`avg(span.duration)`],
      enabled: isPanelOpen,
    },
    'api.performance.queues.avg-duration-chart'
  );

  const durationAxisMax = computeAxisMax([durationData?.[`avg(span.duration)`]]);

  const {
    data: durationSamplesData,
    isFetching: isDurationSamplesDataFetching,
    error: durationSamplesDataError,
    refetch: refetchDurationSpanSamples,
  } = useSpanSamples({
    search: sampleFilters,
    min: 0,
    max: durationAxisMax,
    enabled: isPanelOpen && durationAxisMax > 0,
    fields: [
      SpanIndexedField.TRACE,
      SpanIndexedField.TRANSACTION_ID,
      SpanIndexedField.SPAN_DESCRIPTION,
      SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE,
      SpanIndexedField.MESSAGING_MESSAGE_RECEIVE_LATENCY,
      SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT,
      SpanIndexedField.MESSAGING_MESSAGE_ID,
      SpanIndexedField.TRACE_STATUS,
      SpanIndexedField.SPAN_DURATION,
    ],
  });

  const sampledSpanDataSeries = useSampleScatterPlotSeries(
    durationSamplesData,
    transactionMetrics?.[0]?.['avg(span.duration)'],
    highlightedSpanId,
    'span.duration'
  );

  const findSampleFromDataPoint = (dataPoint: {name: string | number; value: number}) => {
    return durationSamplesData.find(
      s => s.timestamp === dataPoint.name && s['span.duration'] === dataPoint.value
    );
  };

  const handleSearch = (newSpanSearchQuery: string) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        spanSearchQuery: newSpanSearchQuery,
      },
    });
  };

  return (
    <PageAlertProvider>
      <DrawerHeader>
        {project && (
          <SampleDrawerHeaderTransaction
            project={project}
            transaction={query.transaction}
          />
        )}
      </DrawerHeader>

      <SampleDrawerBody>
        <ModuleLayout.Layout>
          <ModuleLayout.Full>
            <MetricsRibbonContainer>
              {messageActorType === MessageActorType.PRODUCER ? (
                <ProducerMetricsRibbon
                  metrics={transactionMetrics}
                  isLoading={aretransactionMetricsFetching}
                />
              ) : (
                <ConsumerMetricsRibbon
                  metrics={transactionMetrics}
                  isLoading={aretransactionMetricsFetching}
                />
              )}
            </MetricsRibbonContainer>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <PanelControls>
              <CompactSelect
                searchable
                value={query.traceStatus}
                options={TRACE_STATUS_SELECT_OPTIONS}
                onChange={handleTraceStatusChange}
                triggerProps={{
                  prefix: t('Status'),
                }}
              />
              {messageActorType === MessageActorType.CONSUMER && (
                <CompactSelect
                  value={query.retryCount}
                  options={RETRY_COUNT_SELECT_OPTIONS}
                  onChange={handleRetryCountChange}
                  triggerProps={{
                    prefix: t('Retries'),
                  }}
                />
              )}
            </PanelControls>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <DurationChartWithSamples
              series={[
                {
                  ...durationData[`avg(span.duration)`],
                  markLine: AverageValueMarkLine({value: avg}),
                },
              ]}
              scatterPlot={sampledSpanDataSeries}
              onHighlight={highlights => {
                const firstHighlight = highlights[0];

                if (!firstHighlight) {
                  setHighlightedSpanId(undefined);
                  return;
                }

                const sample = findSampleFromDataPoint(firstHighlight.dataPoint);
                setHighlightedSpanId(sample?.span_id);
              }}
              isLoading={isDurationDataFetching}
              error={durationError}
            />
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <SpanSearchQueryBuilder
              searchSource={`${ModuleName.QUEUE}-sample-panel`}
              initialQuery={query.spanSearchQuery}
              onSearch={handleSearch}
              placeholder={t('Search for span attributes')}
              projects={selection.projects}
            />
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <MessageSpanSamplesTable
              data={durationSamplesData}
              isLoading={isDurationDataFetching || isDurationSamplesDataFetching}
              highlightedSpanId={highlightedSpanId}
              onSampleMouseOver={sample => setHighlightedSpanId(sample.span_id)}
              onSampleMouseOut={() => setHighlightedSpanId(undefined)}
              error={durationSamplesDataError}
              // Samples endpoint doesn't provide meta data, so we need to provide it here
              meta={{
                fields: {
                  [SpanIndexedField.SPAN_DURATION]: 'duration',
                  [SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE]: 'size',
                  [SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT]: 'number',
                },
                units: {
                  [SpanIndexedField.SPAN_DURATION]: DurationUnit.MILLISECOND,
                  [SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE]: SizeUnit.BYTE,
                },
              }}
              type={messageActorType}
            />
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <Button
              onClick={() => {
                trackAnalytics(
                  'performance_views.sample_spans.try_different_samples_clicked',
                  {organization, source: ModuleName.QUEUE}
                );
                refetchDurationSpanSamples();
              }}
            >
              {t('Try Different Samples')}
            </Button>
          </ModuleLayout.Full>
        </ModuleLayout.Layout>
      </SampleDrawerBody>
    </PageAlertProvider>
  );
}

function ProducerMetricsRibbon({
  metrics,
  isLoading,
}: {
  isLoading: boolean;
  metrics: Partial<SpanMetricsResponse>[];
}) {
  const errorRate = 1 - (metrics[0]?.['trace_status_rate(ok)'] ?? 0);
  return (
    <ReadoutRibbon>
      <MetricReadout
        title={t('Published')}
        value={metrics?.[0]?.['count_op(queue.publish)']}
        unit={'count'}
        isLoading={isLoading}
      />
      <MetricReadout
        title={t('Error Rate')}
        value={errorRate}
        unit={'percentage'}
        isLoading={isLoading}
      />
    </ReadoutRibbon>
  );
}

function ConsumerMetricsRibbon({
  metrics,
  isLoading,
}: {
  isLoading: boolean;
  metrics: Partial<SpanMetricsResponse>[];
}) {
  const errorRate = 1 - (metrics[0]?.['trace_status_rate(ok)'] ?? 0);
  return (
    <ReadoutRibbon>
      <MetricReadout
        title={t('Processed')}
        value={metrics?.[0]?.['count_op(queue.process)']}
        unit={'count'}
        isLoading={isLoading}
      />
      <MetricReadout
        title={t('Error Rate')}
        value={errorRate}
        unit={'percentage'}
        isLoading={isLoading}
      />
      <MetricReadout
        title={t('Avg Time In Queue')}
        value={metrics[0]?.['avg(messaging.message.receive.latency)']}
        unit={DurationUnit.MILLISECOND}
        isLoading={false}
      />
      <MetricReadout
        title={t('Avg Processing Time')}
        value={metrics[0]?.['avg_if(span.duration,span.op,queue.process)']}
        unit={DurationUnit.MILLISECOND}
        isLoading={false}
      />
    </ReadoutRibbon>
  );
}

const SAMPLE_HOVER_DEBOUNCE = 10;

const TRACE_STATUS_SELECT_OPTIONS = [
  {
    value: '',
    label: t('All'),
  },
  ...TRACE_STATUS_OPTIONS.map(status => {
    return {
      value: status,
      label: status,
    };
  }),
];

const RETRY_COUNT_SELECT_OPTIONS = [
  {
    value: '',
    label: t('Any'),
  },
  ...RETRY_COUNT_OPTIONS.map(status => {
    return {
      value: status,
      label: status,
    };
  }),
];

const MetricsRibbonContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

const PanelControls = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
