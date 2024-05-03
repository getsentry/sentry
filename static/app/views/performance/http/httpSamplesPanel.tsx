import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import Link from 'sentry/components/links/link';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {
  EMPTY_OPTION_VALUE,
  escapeFilterValue,
  MutableSearch,
} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {AverageValueMarkLine} from 'sentry/views/performance/charts/averageValueMarkLine';
import {DurationChart} from 'sentry/views/performance/http/charts/durationChart';
import {ResponseCodeCountChart} from 'sentry/views/performance/http/charts/responseCodeCountChart';
import {HTTP_RESPONSE_STATUS_CODES} from 'sentry/views/performance/http/data/definitions';
import {useSpanSamples} from 'sentry/views/performance/http/data/useSpanSamples';
import decodePanel from 'sentry/views/performance/http/queryParameterDecoders/panel';
import decodeResponseCodeClass from 'sentry/views/performance/http/queryParameterDecoders/responseCodeClass';
import {Referrer} from 'sentry/views/performance/http/referrers';
import {SpanSamplesTable} from 'sentry/views/performance/http/tables/spanSamplesTable';
import {useDebouncedState} from 'sentry/views/performance/http/useDebouncedState';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {computeAxisMax} from 'sentry/views/starfish/components/chart';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
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
  const detailKey = query.transaction
    ? [query.domain, query.transactionMethod, query.transaction].filter(Boolean).join(':')
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
    'span.domain':
      query.domain === '' ? EMPTY_OPTION_VALUE : escapeFilterValue(query.domain),
    transaction: query.transaction,
  };

  // These filters are for the charts and samples tables
  const filters: SpanMetricsQueryFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain':
      query.domain === '' ? EMPTY_OPTION_VALUE : escapeFilterValue(query.domain),
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
    referrer: Referrer.SAMPLES_PANEL_METRICS_RIBBON,
  });

  const {
    isFetching: isDurationDataFetching,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search,
    yAxis: [`avg(span.self_time)`],
    enabled: isPanelOpen && query.panel === 'duration',
    referrer: Referrer.SAMPLES_PANEL_DURATION_CHART,
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
    referrer: Referrer.SAMPLES_PANEL_RESPONSE_CODE_CHART,
  });

  // NOTE: Due to some data confusion, the `domain` column in the spans table can either be `null` or `""`. Searches like `"!has:span.domain"` are turned into the ClickHouse clause `isNull(domain)`, and do not match the empty string. We need a query that matches empty strings _and_ null_ which is `(!has:domain OR domain:[""])`. This hack can be removed in August 2024, once https://github.com/getsentry/snuba/pull/5780 has been deployed for 90 days and all `""` domains have fallen out of the data retention window. Also, `null` domains will become more rare as people upgrade the JS SDK to versions that populate the `server.address` span attribute
  const sampleSpansSearch = MutableSearch.fromQueryObject({
    ...filters,
    'span.domain': undefined,
  });

  if (query.domain === '') {
    sampleSpansSearch.addOp('(');
    sampleSpansSearch.addFilterValue('!has', 'span.domain');
    sampleSpansSearch.addOp('OR');
    // HACK: Use `addOp` to add the condition `'span.domain:[""]'` and avoid escaping the double quotes. Ideally there'd be a way to specify this explicitly, but this whole thing is a hack anyway. Once a plain `!has:span.domain` condition works, this is not necessary
    sampleSpansSearch.addOp('span.domain:[""]');
    sampleSpansSearch.addOp(')');
  } else {
    sampleSpansSearch.addFilterValue('span.domain', query.domain);
  }
  const durationAxisMax = computeAxisMax([durationData?.[`avg(span.self_time)`]]);

  const {
    data: durationSamplesData,
    isFetching: isDurationSamplesDataFetching,
    error: durationSamplesDataError,
    refetch: refetchDurationSpanSamples,
  } = useSpanSamples({
    search: sampleSpansSearch,
    fields: [
      SpanIndexedField.TRACE,
      SpanIndexedField.TRANSACTION_ID,
      SpanIndexedField.SPAN_DESCRIPTION,
      SpanIndexedField.RESPONSE_CODE,
    ],
    min: 0,
    max: durationAxisMax,
    enabled: isPanelOpen && query.panel === 'duration' && durationAxisMax > 0,
    referrer: Referrer.SAMPLES_PANEL_DURATION_SAMPLES,
  });

  const {
    data: responseCodeSamplesData,
    isFetching: isResponseCodeSamplesDataFetching,
    error: responseCodeSamplesDataError,
    refetch: refetchResponseCodeSpanSamples,
  } = useIndexedSpans({
    search: sampleSpansSearch,
    fields: [
      SpanIndexedField.PROJECT,
      SpanIndexedField.TRACE,
      SpanIndexedField.TRANSACTION_ID,
      SpanIndexedField.ID,
      SpanIndexedField.TIMESTAMP,
      SpanIndexedField.SPAN_DESCRIPTION,
      SpanIndexedField.RESPONSE_CODE,
    ],
    sorts: [SPAN_SAMPLES_SORT],
    limit: SPAN_SAMPLE_LIMIT,
    enabled: isPanelOpen && query.panel === 'status',
    referrer: Referrer.SAMPLES_PANEL_RESPONSE_CODE_SAMPLES,
  });

  const sampledSpanDataSeries = useSampleScatterPlotSeries(
    durationSamplesData,
    domainTransactionMetrics?.[0]?.['avg(span.self_time)'],
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
                  'http.client'
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
                  data={durationSamplesData}
                  isLoading={isDurationDataFetching || isDurationSamplesDataFetching}
                  highlightedSpanId={highlightedSpanId}
                  onSampleMouseOver={sample => setHighlightedSpanId(sample.span_id)}
                  onSampleMouseOut={() => setHighlightedSpanId(undefined)}
                  error={durationSamplesDataError}
                  // TODO: The samples endpoint doesn't provide its own meta, so we need to create it manually
                  meta={{
                    fields: {
                      'span.response_code': 'number',
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
            </Fragment>
          )}

          {query.panel === 'status' && (
            <Fragment>
              <ModuleLayout.Full>
                <ResponseCodeCountChart
                  series={Object.values(responseCodeData).filter(Boolean)}
                  isLoading={isResponseCodeDataLoading}
                  error={responseCodeError}
                />
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                <SpanSamplesTable
                  data={responseCodeSamplesData ?? []}
                  isLoading={isResponseCodeSamplesDataFetching}
                  error={responseCodeSamplesDataError}
                  // TODO: The samples endpoint doesn't provide its own meta, so we need to create it manually
                  meta={{
                    fields: {
                      'span.response_code': 'number',
                    },
                    units: {},
                  }}
                />
              </ModuleLayout.Full>

              <ModuleLayout.Full>
                <Button onClick={() => refetchResponseCodeSpanSamples()}>
                  {t('Try Different Samples')}
                </Button>
              </ModuleLayout.Full>
            </Fragment>
          )}
        </ModuleLayout.Layout>
      </DetailPanel>
    </PageAlertProvider>
  );
}

const SAMPLE_HOVER_DEBOUNCE = 10;

const SPAN_SAMPLE_LIMIT = 10;

// This is functionally a random sort, which is what we want
const SPAN_SAMPLES_SORT = {
  field: 'span_id',
  kind: 'desc' as const,
};

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
