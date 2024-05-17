import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {AverageValueMarkLine} from 'sentry/views/performance/charts/averageValueMarkLine';
import {DurationChart} from 'sentry/views/performance/http/charts/durationChart';
import {useSpanSamples} from 'sentry/views/performance/http/data/useSpanSamples';
import {useDebouncedState} from 'sentry/views/performance/http/useDebouncedState';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {MessageSpanSamplesTable} from 'sentry/views/performance/queues/destinationSummary/messageSpanSamplesTable';
import {useQueuesMetricsQuery} from 'sentry/views/performance/queues/queries/useQueuesMetricsQuery';
import {Referrer} from 'sentry/views/performance/queues/referrers';
import {
  CONSUMER_QUERY_FILTER,
  MessageActorType,
  PRODUCER_QUERY_FILTER,
} from 'sentry/views/performance/queues/settings';
import {Subtitle} from 'sentry/views/profiling/landing/styles';
import {computeAxisMax} from 'sentry/views/starfish/components/chart';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import {
  ModuleName,
  SpanIndexedField,
  type SpanMetricsResponse,
} from 'sentry/views/starfish/types';
import {useSampleScatterPlotSeries} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';

export function MessageSpanSamplesPanel() {
  const router = useRouter();
  const location = useLocation();
  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      destination: decodeScalar,
      transaction: decodeScalar,
      retries: decodeScalar,
      status: decodeScalar,
      'span.op': decodeScalar,
    },
  });
  const {projects} = useProjects();
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

  const handleStatusChange = newStatus => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'status',
      new_state: newStatus.value,
      organization,
      source: ModuleName.QUEUE,
    });
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        status: newStatus.value,
      },
    });
  };

  const handleRetriesChange = newRetries => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'retries',
      new_state: newRetries.value,
      organization,
      source: ModuleName.QUEUE,
    });
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        retries: newRetries.value,
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

  const search = new MutableSearch(queryFilter);
  search.addFilterValue('transaction', query.transaction);
  search.addFilterValue('messaging.destination.name', query.destination);

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
      search,
      yAxis: [`avg(span.duration)`],
      enabled: isPanelOpen,
    },
    'api.performance.queues.avg-duration-chart'
  );

  const durationAxisMax = computeAxisMax([durationData?.[`avg(span.duration)`]]);

  if (query.status.length > 0) {
    search.addFilterValue('trace.status', query.status);
  }

  // Note: only consumers should show the retry count filter
  if (messageActorType === MessageActorType.CONSUMER) {
    if (query.retries === '0') {
      search.addFilterValue('measurements.messaging.message.retry.count', '0');
    } else if (query.retries === '1-3') {
      search.addFilterValues('measurements.messaging.message.retry.count', [
        '>=1',
        '<=3',
      ]);
    } else if (query.retries === '4+') {
      search.addFilterValue('measurements.messaging.message.retry.count', '>=4');
    }
  }

  const {
    data: durationSamplesData,
    isFetching: isDurationSamplesDataFetching,
    error: durationSamplesDataError,
    refetch: refetchDurationSpanSamples,
  } = useSpanSamples({
    search,
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

  const handleClose = () => {
    router.replace({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        transaction: undefined,
        transactionMethod: undefined,
      },
    });
  };

  const handleOpen = useCallback(() => {
    if (query.transaction) {
      trackAnalytics('performance_views.sample_spans.opened', {
        organization,
        source: ModuleName.QUEUE,
      });
    }
  }, [organization, query.transaction]);

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={detailKey} onClose={handleClose} onOpen={handleOpen}>
        <ModuleLayout.Layout>
          <ModuleLayout.Full>
            <HeaderContainer>
              {project ? (
                <SpanSummaryProjectAvatar
                  project={project}
                  direction="left"
                  size={40}
                  hasTooltip
                  tooltip={project.slug}
                />
              ) : (
                <div />
              )}
              <TitleContainer>
                <Subtitle>
                  {messageActorType === MessageActorType.PRODUCER
                    ? t('Producer')
                    : t('Consumer')}
                </Subtitle>
                <Title>
                  <Link
                    to={normalizeUrl(
                      `/organizations/${organization.slug}/performance/summary?${qs.stringify(
                        {
                          project: query.project,
                          transaction: query.transaction,
                        }
                      )}`
                    )}
                  >
                    {query.transaction}
                  </Link>
                </Title>
              </TitleContainer>
            </HeaderContainer>
          </ModuleLayout.Full>

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
                value={query.status}
                options={STATUS_OPTIONS}
                onChange={handleStatusChange}
                triggerProps={{
                  prefix: t('Status'),
                }}
              />
              {messageActorType === MessageActorType.CONSUMER && (
                <CompactSelect
                  value={query.retries}
                  options={RETRIES_OPTIONS}
                  onChange={handleRetriesChange}
                  triggerProps={{
                    prefix: t('Retries'),
                  }}
                />
              )}
            </PanelControls>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <DurationChart
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
      </DetailPanel>
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
    <Fragment>
      <MetricReadout
        align="left"
        title={t('Published')}
        value={metrics?.[0]?.['count_op(queue.publish)']}
        unit={'count'}
        isLoading={isLoading}
      />
      <MetricReadout
        align="left"
        title={t('Error Rate')}
        value={errorRate}
        unit={'percentage'}
        isLoading={isLoading}
      />
    </Fragment>
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
    <Fragment>
      <MetricReadout
        align="left"
        title={t('Processed')}
        value={metrics?.[0]?.['count_op(queue.process)']}
        unit={'count'}
        isLoading={isLoading}
      />
      <MetricReadout
        align="left"
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
    </Fragment>
  );
}

const SAMPLE_HOVER_DEBOUNCE = 10;

const STATUS_OPTIONS = [
  {
    value: '',
    label: t('All'),
  },
  ...[
    'ok',
    'cancelled',
    'unknown',
    'unknown_error',
    'invalid_argument',
    'deadline_exceeded',
    'not_found',
    'already_exists',
    'permission_denied',
    'resource_exhausted',
    'failed_precondition',
    'aborted',
    'out_of_range',
    'unimplemented',
    'internal_error',
    'unavailable',
    'data_loss',
    'unauthenticated',
  ].map(status => {
    return {
      value: status,
      label: t('%s', status),
    };
  }),
];

const RETRIES_OPTIONS = [
  {
    value: '',
    label: t('Any'),
  },
  {
    value: '0',
    label: t('0'),
  },
  {
    value: '1-3',
    label: t('1-3'),
  },
  {
    value: '4+',
    label: t('4+'),
  },
];

const SpanSummaryProjectAvatar = styled(ProjectAvatar)`
  padding-right: ${space(1)};
`;

const HeaderContainer = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;

const TitleContainer = styled('div')`
  width: 100%;
  position: relative;
  height: 40px;
`;

const Title = styled('h4')`
  position: absolute;
  bottom: 0;
  margin-bottom: 0;
`;

const MetricsRibbonContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

const PanelControls = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
