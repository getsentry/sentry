import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
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
import {MessageSpanSamplesTable} from 'sentry/views/performance/queues/messageSpanSamplesTable';
import {useQueuesMetricsQuery} from 'sentry/views/performance/queues/queries/useQueuesMetricsQuery';
import {
  CONSUMER_QUERY_FILTER,
  MessageActorType,
  PRODUCER_QUERY_FILTER,
} from 'sentry/views/performance/queues/settings';
import {Subtitle} from 'sentry/views/profiling/landing/styles';
import {computeAxisMax} from 'sentry/views/starfish/components/chart';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import {SpanIndexedField, type SpanMetricsResponse} from 'sentry/views/starfish/types';
import {useSampleScatterPlotSeries} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';

export function MessageSamplesPanel() {
  const router = useRouter();
  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      destination: decodeScalar,
      transaction: decodeScalar,
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

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={detailKey} onClose={handleClose}>
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
            <Button onClick={() => refetchDurationSpanSamples()}>
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
  return (
    <Fragment>
      <MetricReadout
        align="left"
        title={t('Published')}
        value={metrics?.[0]?.['count()']}
        unit={'count'}
        isLoading={isLoading}
      />
      <MetricReadout
        align="left"
        title={t('Error Rate')}
        value={undefined}
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
  return (
    <Fragment>
      <MetricReadout
        align="left"
        title={t('Processed')}
        value={metrics?.[0]?.['count()']}
        unit={'count'}
        isLoading={isLoading}
      />
      <MetricReadout
        align="left"
        title={t('Error Rate')}
        value={undefined}
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
        title={t('Avg Processing Latency')}
        value={metrics[0]?.['avg_if(span.duration,span.op,queue.process)']}
        unit={DurationUnit.MILLISECOND}
        isLoading={false}
      />
    </Fragment>
  );
}

const SAMPLE_HOVER_DEBOUNCE = 10;

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
