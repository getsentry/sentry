import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
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
import {computeAxisMax} from 'sentry/views/starfish/components/chart';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import {useSampleScatterPlotSeries} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';

// We're defining our own query filter here, apart from settings.ts because the spans endpoint doesn't accept IN operations
const DEFAULT_QUERY_FILTER = 'span.op:queue.process OR span.op:queue.publish';

export function MessageConsumerSamplesPanel() {
  const router = useRouter();
  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      destination: decodeScalar,
      transaction: decodeScalar,
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

  // TODO: This should also filter on destination
  const search = new MutableSearch(DEFAULT_QUERY_FILTER);
  search.addFilterValue('transaction', query.transaction);
  search.addFilterValue('messaging.destination.name', query.destination);

  const {data: transactionMetrics, isFetching: aretransactionMetricsFetching} =
    useQueuesMetricsQuery({
      destination: query.destination,
      transaction: query.transaction,
      enabled: isPanelOpen,
    });

  const {
    isFetching: isDurationDataFetching,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search,
    yAxis: [`avg(span.self_time)`],
    enabled: isPanelOpen,
  });

  const durationAxisMax = computeAxisMax([durationData?.[`avg(span.self_time)`]]);

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
  });

  const sampledSpanDataSeries = useSampleScatterPlotSeries(
    durationSamplesData,
    transactionMetrics?.[0]?.['avg(span.self_time)'],
    highlightedSpanId
  );

  const findSampleFromDataPoint = (dataPoint: {name: string | number; value: number}) => {
    return durationSamplesData.find(
      s => s.timestamp === dataPoint.name && s['span.self_time'] === dataPoint.value
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
              {project && (
                <SpanSummaryProjectAvatar
                  project={project}
                  direction="left"
                  size={40}
                  hasTooltip
                  tooltip={project.slug}
                />
              )}
              <TitleContainer>
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
            <MetricsRibbon>
              <MetricReadout
                align="left"
                title={t('Processed')}
                value={transactionMetrics?.[0]?.['count()']}
                unit={'count'}
                isLoading={aretransactionMetricsFetching}
              />
              <MetricReadout
                align="left"
                title={t('Error Rate')}
                value={undefined}
                unit={'percentage'}
                isLoading={aretransactionMetricsFetching}
              />
              <MetricReadout
                title={t('Avg Time In Queue')}
                value={transactionMetrics[0]?.['avg(messaging.message.receive.latency)']}
                unit={DurationUnit.MILLISECOND}
                isLoading={false}
              />
              <MetricReadout
                title={t('Avg Processing Latency')}
                value={
                  transactionMetrics[0]?.['avg_if(span.self_time,span.op,queue.process)']
                }
                unit={DurationUnit.MILLISECOND}
                isLoading={false}
              />
            </MetricsRibbon>
          </ModuleLayout.Full>
          <ModuleLayout.Full>
            <DurationChart
              series={[
                {
                  ...durationData[`avg(span.self_time)`],
                  markLine: AverageValueMarkLine(),
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
                  'span.self_time': 'duration',
                },
                units: {},
              }}
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

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;
