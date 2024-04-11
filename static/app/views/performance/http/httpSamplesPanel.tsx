import {Fragment} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
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
import {HTTP_RESPONSE_STATUS_CODES} from 'sentry/views/performance/http/definitions';
import {DurationChart} from 'sentry/views/performance/http/durationChart';
import decodePanel from 'sentry/views/performance/http/queryParameterDecoders/panel';
import decodeResponseCodeClass from 'sentry/views/performance/http/queryParameterDecoders/responseCodeClass';
import {ResponseCodeCountChart} from 'sentry/views/performance/http/responseCodeCountChart';
import {SpanSamplesTable} from 'sentry/views/performance/http/spanSamplesTable';
import {useDebouncedState} from 'sentry/views/performance/http/useDebouncedState';
import {useSpanSamples} from 'sentry/views/performance/http/useSpanSamples';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {computeAxisMax} from 'sentry/views/starfish/components/chart';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {useSpanMetricsTopNSeries} from 'sentry/views/starfish/queries/useSpanMetricsTopNSeries';
import {
  ModuleName,
  SpanFunction,
  SpanIndexedField,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {useSampleScatterPlotSeries} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';

export function HTTPSamplesPanel() {
  const router = useRouter();
  const location = useLocation();

  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      domain: decodeScalar,
      transaction: decodeScalar,
      transactionMethod: decodeScalar,
      panel: decodePanel,
      responseCodeClass: decodeResponseCodeClass,
    },
  });

  const organization = useOrganization();

  const {projects} = useProjects();
  const project = projects.find(p => query.project === p.id);

  const [highlightedSpanId, setHighlightedSpanId] = useDebouncedState<string | undefined>(
    undefined,
    [],

    SAMPLE_HOVER_DEBOUNCE
  );

  // `detailKey` controls whether the panel is open. If all required properties are available, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey =
    query.transaction && query.domain
      ? [query.domain, query.transactionMethod, query.transaction]
          .filter(Boolean)
          .join(':')
      : undefined;

  const handlePanelChange = newPanelName => {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        panel: newPanelName,
      },
    });
  };

  const handleResponseCodeClassChange = newResponseCodeClass => {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        responseCodeClass: newResponseCodeClass.value,
      },
    });
  };

  const isPanelOpen = Boolean(detailKey);

  // The ribbon is above the data selectors, and not affected by them. So, it has its own filters.
  const ribbonFilters: SpanMetricsQueryFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain': query.domain,
    transaction: query.transaction,
  };

  // These filters are for the charts and samples tables
  const filters: SpanMetricsQueryFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain': query.domain,
    transaction: query.transaction,
  };

  const responseCodeInRange = query.responseCodeClass
    ? Object.keys(HTTP_RESPONSE_STATUS_CODES).filter(code =>
        code.startsWith(query.responseCodeClass)
      )
    : [];

  if (responseCodeInRange.length > 0) {
    // TODO: Allow automatic array parameter concatenation
    filters['span.status_code'] = `[${responseCodeInRange.join(',')}]`;
  }

  const search = MutableSearch.fromQueryObject(filters);

  const {
    data: domainTransactionMetrics,
    isFetching: areDomainTransactionMetricsFetching,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(ribbonFilters),
    fields: [
      `${SpanFunction.SPM}()`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      'http_response_rate(3)',
      'http_response_rate(4)',
      'http_response_rate(5)',
      `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
    ],
    enabled: isPanelOpen,
    referrer: 'api.starfish.http-module-samples-panel-metrics-ribbon',
  });

  const {
    isFetching: isDurationDataFetching,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search,
    yAxis: [`avg(span.self_time)`],
    enabled: isPanelOpen && query.panel === 'duration',
    referrer: 'api.starfish.http-module-samples-panel-duration-chart',
  });

  const {
    isFetching: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsTopNSeries({
    search,
    fields: ['span.status_code', 'count()'],
    yAxis: ['count()'],
    topEvents: 5,
    enabled: isPanelOpen && query.panel === 'status',
    referrer: 'api.starfish.http-module-samples-panel-response-code-chart',
  });

  const durationAxisMax = computeAxisMax([durationData?.[`avg(span.self_time)`]]);

  const {
    data: samplesData,
    isFetching: isSamplesDataFetching,
    error: samplesDataError,
    refetch: refetchSpanSamples,
  } = useSpanSamples({
    search,
    fields: [
      SpanIndexedField.TRANSACTION_ID,
      SpanIndexedField.SPAN_DESCRIPTION,
      SpanIndexedField.RESPONSE_CODE,
    ],
    min: 0,
    max: durationAxisMax,
    enabled: query.panel === 'duration' && durationAxisMax > 0,
    referrer: 'api.starfish.http-module-samples-panel-samples',
  });

  const sampledSpanDataSeries = useSampleScatterPlotSeries(
    samplesData,
    domainTransactionMetrics?.[0]?.['avg(span.self_time)'],
    highlightedSpanId
  );

  const findSampleFromDataPoint = (dataPoint: {name: string | number; value: number}) => {
    return samplesData.find(
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
                    {query.transaction &&
                    query.transactionMethod &&
                    !query.transaction.startsWith(query.transactionMethod)
                      ? `${query.transactionMethod} ${query.transaction}`
                      : query.transaction}
                  </Link>
                </Title>
              </TitleContainer>
            </HeaderContainer>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <MetricsRibbon>
              <MetricReadout
                align="left"
                title={getThroughputTitle('http')}
                value={domainTransactionMetrics?.[0]?.[`${SpanFunction.SPM}()`]}
                unit={RateUnit.PER_MINUTE}
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles.avg}
                value={
                  domainTransactionMetrics?.[0]?.[
                    `avg(${SpanMetricsField.SPAN_SELF_TIME})`
                  ]
                }
                unit={DurationUnit.MILLISECOND}
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={t('3XXs')}
                value={domainTransactionMetrics?.[0]?.[`http_response_rate(3)`]}
                unit="percentage"
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={t('4XXs')}
                value={domainTransactionMetrics?.[0]?.[`http_response_rate(4)`]}
                unit="percentage"
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={t('5XXs')}
                value={domainTransactionMetrics?.[0]?.[`http_response_rate(5)`]}
                unit="percentage"
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles.timeSpent}
                value={domainTransactionMetrics?.[0]?.['sum(span.self_time)']}
                unit={DurationUnit.MILLISECOND}
                tooltip={getTimeSpentExplanation(
                  domainTransactionMetrics?.[0]?.['time_spent_percentage()'],
                  'db'
                )}
                isLoading={areDomainTransactionMetricsFetching}
              />
            </MetricsRibbon>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <PanelControls>
              <SegmentedControl
                value={query.panel}
                onChange={handlePanelChange}
                aria-label={t('Choose breakdown type')}
              >
                <SegmentedControl.Item key="duration">
                  {t('By Duration')}
                </SegmentedControl.Item>
                <SegmentedControl.Item key="status">
                  {t('By Response Code')}
                </SegmentedControl.Item>
              </SegmentedControl>

              <CompactSelect
                value={query.responseCodeClass}
                options={HTTP_RESPONSE_CODE_CLASS_OPTIONS}
                onChange={handleResponseCodeClassChange}
                triggerProps={{
                  prefix: t('Response Code'),
                }}
              />
            </PanelControls>
          </ModuleLayout.Full>

          {query.panel === 'duration' && (
            <Fragment>
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
                <SpanSamplesTable
                  data={samplesData}
                  isLoading={isDurationDataFetching || isSamplesDataFetching}
                  highlightedSpanId={highlightedSpanId}
                  onSampleMouseOver={sample => setHighlightedSpanId(sample.span_id)}
                  onSampleMouseOut={() => setHighlightedSpanId(undefined)}
                  error={samplesDataError}
                  // TODO: The samples endpoint doesn't provide its own meta, so we need to create it manually
                  meta={{
                    fields: {
                      'span.response_code': 'number',
                    },
                    units: {},
                  }}
                />
              </ModuleLayout.Full>
            </Fragment>
          )}

          {query.panel === 'status' && (
            <ModuleLayout.Full>
              <ResponseCodeCountChart
                series={Object.values(responseCodeData).filter(Boolean)}
                isLoading={isResponseCodeDataLoading}
                error={responseCodeError}
              />
            </ModuleLayout.Full>
          )}

          <ModuleLayout.Full>
            <Button onClick={() => refetchSpanSamples()}>
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

const HTTP_RESPONSE_CODE_CLASS_OPTIONS = [
  {
    value: '',
    label: t('All'),
  },
  {
    value: '2',
    label: t('2XXs'),
  },
  {
    value: '3',
    label: t('3XXs'),
  },
  {
    value: '4',
    label: t('4XXs'),
  },
  {
    value: '5',
    label: t('5XXs'),
  },
];

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

const PanelControls = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(2)};
`;
