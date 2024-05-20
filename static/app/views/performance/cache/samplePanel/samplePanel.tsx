import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {CacheHitMissChart} from 'sentry/views/performance/cache/charts/hitMissChart';
import {Referrer} from 'sentry/views/performance/cache/referrers';
import {TransactionDurationChart} from 'sentry/views/performance/cache/samplePanel/charts/transactionDurationChart';
import {BASE_FILTERS} from 'sentry/views/performance/cache/settings';
import {SpanSamplesTable} from 'sentry/views/performance/cache/tables/spanSamplesTable';
import {useDebouncedState} from 'sentry/views/performance/http/useDebouncedState';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useMetrics, useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {useTransactions} from 'sentry/views/starfish/queries/useTransactions';
import {
  MetricsFields,
  type MetricsQueryFilters,
  ModuleName,
  SpanFunction,
  SpanIndexedField,
  type SpanIndexedQueryFilters,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {findSampleFromDataPoint} from 'sentry/views/starfish/utils/chart/findDataPoint';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

// This is similar to http sample table, its difficult to use the generic span samples sidebar as we require a bunch of custom things.
export function CacheSamplePanel() {
  const router = useRouter();
  const location = useLocation();
  const organization = useOrganization();

  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      transaction: decodeScalar,
      statusClass: decodeScalar,
    },
  });

  const [highlightedSpanId, setHighlightedSpanId] = useDebouncedState<string | undefined>(
    undefined,
    [],
    10
  );

  const handleStatusClassChange = newStatusClass => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'status',
      new_state: newStatusClass.value,
      organization,
      source: ModuleName.CACHE,
    });
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        statusClass: newStatusClass.value,
      },
    });
  };

  // `detailKey` controls whether the panel is open. If all required properties are ailable, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey = query.transaction
    ? [query.transaction].filter(Boolean).join(':')
    : undefined;

  const isPanelOpen = Boolean(detailKey);

  const filters: SpanMetricsQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    'project.id': query.project,
  };

  const {data: cacheHitRateData, isLoading: isCacheHitRateLoading} = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters satisfies SpanMetricsQueryFilters),
      yAxis: [`${SpanFunction.CACHE_MISS_RATE}()`],
    },
    Referrer.SAMPLES_CACHE_HIT_MISS_CHART
  );

  const {data: cacheTransactionMetrics, isFetching: areCacheTransactionMetricsFetching} =
    useSpanMetrics(
      {
        search: MutableSearch.fromQueryObject(filters),
        fields: [
          `${SpanFunction.SPM}()`,
          `${SpanFunction.CACHE_MISS_RATE}()`,
          `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
          `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
          `avg(${SpanMetricsField.CACHE_ITEM_SIZE})`,
        ],
        enabled: isPanelOpen,
      },
      Referrer.SAMPLES_CACHE_METRICS_RIBBON
    );

  const {data: transactionDurationData, isLoading: isTransactionDurationLoading} =
    useMetrics(
      {
        search: MutableSearch.fromQueryObject({
          transaction: query.transaction,
        } satisfies MetricsQueryFilters),
        fields: [`avg(${MetricsFields.TRANSACTION_DURATION})`],
        enabled: isPanelOpen && Boolean(query.transaction),
      },
      Referrer.SAMPLES_CACHE_TRANSACTION_DURATION
    );

  const sampleFilters: SpanIndexedQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    project_id: query.project,
  };

  const useIndexedCacheSpans = (isCacheHit, limit) =>
    useIndexedSpans({
      search: MutableSearch.fromQueryObject({...sampleFilters, 'cache.hit': isCacheHit}),
      fields: [
        SpanIndexedField.PROJECT,
        SpanIndexedField.TRACE,
        SpanIndexedField.TRANSACTION_ID,
        SpanIndexedField.ID,
        SpanIndexedField.TIMESTAMP,
        SpanIndexedField.SPAN_DESCRIPTION,
        SpanIndexedField.CACHE_HIT,
        SpanIndexedField.SPAN_OP,
        SpanIndexedField.CACHE_ITEM_SIZE,
      ],
      sorts: [SPAN_SAMPLES_SORT],
      limit: limit,
      enabled: isPanelOpen,
      referrer: Referrer.SAMPLES_CACHE_SPAN_SAMPLES,
    });

  // display half hits and half misses by default
  let cacheHitSamplesLimit = SPAN_SAMPLE_LIMIT / 2;
  let cacheMissSamplesLimit = SPAN_SAMPLE_LIMIT / 2;

  if (query.statusClass === 'hit') {
    cacheHitSamplesLimit = SPAN_SAMPLE_LIMIT;
    cacheMissSamplesLimit = -1;
  } else if (query.statusClass === 'miss') {
    cacheHitSamplesLimit = -1;
    cacheMissSamplesLimit = SPAN_SAMPLE_LIMIT;
  }

  const {
    data: cacheHitSamples,
    isFetching: isCacheHitsFetching,
    refetch: refetchCacheHits,
  } = useIndexedCacheSpans('true', cacheHitSamplesLimit);

  const {
    data: cacheMissSamples,
    isFetching: isCacheMissesFetching,
    refetch: refetchCacheMisses,
  } = useIndexedCacheSpans('false', cacheMissSamplesLimit);

  const cacheSamples = [...(cacheHitSamples || []), ...(cacheMissSamples || [])];

  const {
    data: transactionData,
    error: transactionError,
    isFetching: isFetchingTransactions,
  } = useTransactions(
    cacheSamples?.map(span => span['transaction.id']) || [],
    Referrer.SAMPLES_CACHE_SPAN_SAMPLES
  );

  const transactionDurationsMap = keyBy(transactionData, 'id');

  const spansWithDuration =
    cacheSamples?.map(span => ({
      ...span,
      'transaction.duration':
        transactionDurationsMap[span['transaction.id']]?.['transaction.duration'],
    })) || [];

  const {projects} = useProjects();
  const project = projects.find(p => query.project === p.id);

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
        source: ModuleName.CACHE,
      });
    }
  }, [organization, query.transaction]);

  const handleRefetch = () => {
    refetchCacheHits();
    refetchCacheMisses();
  };

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={detailKey} onClose={handleClose} onOpen={handleOpen}>
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
                title={DataTitles[`avg(${SpanMetricsField.CACHE_ITEM_SIZE})`]}
                value={
                  cacheTransactionMetrics?.[0]?.[
                    `avg(${SpanMetricsField.CACHE_ITEM_SIZE})`
                  ]
                }
                unit={SizeUnit.BYTE}
                isLoading={areCacheTransactionMetricsFetching}
              />
              <MetricReadout
                align="left"
                title={getThroughputTitle('cache')}
                value={cacheTransactionMetrics?.[0]?.[`${SpanFunction.SPM}()`]}
                unit={RateUnit.PER_MINUTE}
                isLoading={areCacheTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles[`avg(${MetricsFields.TRANSACTION_DURATION})`]}
                value={
                  transactionDurationData?.[0]?.[
                    `avg(${MetricsFields.TRANSACTION_DURATION})`
                  ]
                }
                unit={DurationUnit.MILLISECOND}
                isLoading={isTransactionDurationLoading}
              />

              <MetricReadout
                align="left"
                title={DataTitles.cacheMissRate}
                value={
                  cacheTransactionMetrics?.[0]?.[`${SpanFunction.CACHE_MISS_RATE}()`]
                }
                unit="percentage"
                isLoading={areCacheTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles.timeSpent}
                value={cacheTransactionMetrics?.[0]?.['sum(span.self_time)']}
                unit={DurationUnit.MILLISECOND}
                tooltip={getTimeSpentExplanation(
                  cacheTransactionMetrics?.[0]?.['time_spent_percentage()']
                )}
                isLoading={areCacheTransactionMetricsFetching}
              />
            </MetricsRibbon>
          </ModuleLayout.Full>
          <ModuleLayout.Full>
            <CompactSelect
              value={query.statusClass}
              options={CACHE_STATUS_OPTIONS}
              onChange={handleStatusClassChange}
              triggerProps={{
                prefix: t('Status'),
              }}
            />
          </ModuleLayout.Full>
          <ModuleLayout.Half>
            <CacheHitMissChart
              isLoading={isCacheHitRateLoading}
              series={cacheHitRateData[`cache_miss_rate()`]}
            />
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <TransactionDurationChart
              samples={spansWithDuration}
              averageTransactionDuration={
                transactionDurationData?.[0]?.[
                  `avg(${MetricsFields.TRANSACTION_DURATION})`
                ]
              }
              highlightedSpanId={highlightedSpanId}
              onHighlight={highlights => {
                const firstHighlight = highlights[0];

                if (!firstHighlight) {
                  setHighlightedSpanId(undefined);
                  return;
                }

                const sample = findSampleFromDataPoint<(typeof spansWithDuration)[0]>(
                  firstHighlight.dataPoint,
                  spansWithDuration,
                  'transaction.duration'
                );
                setHighlightedSpanId(sample?.span_id);
              }}
            />
          </ModuleLayout.Half>

          <Fragment>
            <ModuleLayout.Full>
              <SpanSamplesTable
                data={spansWithDuration ?? []}
                meta={{
                  fields: {
                    'transaction.duration': 'duration',
                    [SpanIndexedField.CACHE_ITEM_SIZE]: 'size',
                  },
                  units: {[SpanIndexedField.CACHE_ITEM_SIZE]: 'byte'},
                }}
                isLoading={
                  isCacheHitsFetching || isCacheMissesFetching || isFetchingTransactions
                }
                highlightedSpanId={highlightedSpanId}
                onSampleMouseOver={sample => setHighlightedSpanId(sample.span_id)}
                onSampleMouseOut={() => setHighlightedSpanId(undefined)}
                error={transactionError}
              />
            </ModuleLayout.Full>
          </Fragment>

          <Fragment>
            <ModuleLayout.Full>
              <Button
                onClick={() => {
                  trackAnalytics(
                    'performance_views.sample_spans.try_different_samples_clicked',
                    {organization, source: ModuleName.CACHE}
                  );
                  handleRefetch();
                }}
              >
                {t('Try Different Samples')}
              </Button>
            </ModuleLayout.Full>
          </Fragment>
        </ModuleLayout.Layout>
      </DetailPanel>
    </PageAlertProvider>
  );
}

const SPAN_SAMPLE_LIMIT = 10;

const SPAN_SAMPLES_SORT = {
  field: 'span_id',
  kind: 'desc' as const,
};

const CACHE_STATUS_OPTIONS = [
  {
    value: '',
    label: t('All'),
  },
  {
    value: 'hit',
    label: t('Hit'),
  },
  {
    value: 'miss',
    label: t('Miss'),
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

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;
