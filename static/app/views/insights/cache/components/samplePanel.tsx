import {Fragment, useEffect, useMemo, useState} from 'react';
import keyBy from 'lodash/keyBy';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {EventDrawerHeader} from 'sentry/components/events/eventDrawer';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';
import {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {CacheHitMissChart} from 'sentry/views/insights/cache/components/charts/hitMissChart';
import {TransactionDurationChartWithSamples} from 'sentry/views/insights/cache/components/charts/transactionDurationChartWithSamples';
import {SpanSamplesTable} from 'sentry/views/insights/cache/components/tables/spanSamplesTable';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {SampleDrawerHeaderTransaction} from 'sentry/views/insights/common/components/sampleDrawerHeaderTransaction';
import {
  useDiscoverOrEap,
  useEAPSpans,
  useMetrics,
  useSpanMetrics,
  useSpansIndexed,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {InsightsSpanTagProvider} from 'sentry/views/insights/pages/insightsSpanTagProvider';
import type {
  MetricsQueryFilters,
  SpanIndexedQueryFilters,
  SpanIndexedResponse,
  SpanMetricsQueryFilters,
  SpanQueryFilters,
} from 'sentry/views/insights/types';
import {
  MetricsFields,
  ModuleName,
  SpanFields,
  SpanFunction,
  SpanIndexedField,
  SpanMetricsField,
} from 'sentry/views/insights/types';

// This is similar to http sample table, its difficult to use the generic span samples sidebar as we require a bunch of custom things.
export function CacheSamplePanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      transaction: decodeScalar,
      statusClass: decodeScalar,
      spanSearchQuery: decodeScalar,
    },
  });

  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );

  // @ts-expect-error TS(7006): Parameter 'newStatusClass' implicitly has an 'any'... Remove this comment to see the full error message
  const handleStatusClassChange = newStatusClass => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'status',
      new_state: newStatusClass.value,
      organization,
      source: ModuleName.CACHE,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        statusClass: newStatusClass.value,
      },
    });
  };

  const filters: SpanMetricsQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    'project.id': query.project,
  };

  const search = MutableSearch.fromQueryObject(filters);

  const {data: cacheTransactionMetrics, isFetching: areCacheTransactionMetricsFetching} =
    useSpanMetrics(
      {
        search,
        fields: [
          `${SpanFunction.EPM}()`,
          `${SpanFunction.CACHE_MISS_RATE}()`,
          `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
          `avg(${SpanMetricsField.CACHE_ITEM_SIZE})`,
        ],
      },
      Referrer.SAMPLES_CACHE_METRICS_RIBBON
    );

  const {data: transactionDurationData, isPending: isTransactionDurationLoading} =
    useTransactionDuration({transaction: query.transaction});

  const sampleFilters: SpanIndexedQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    project_id: query.project,
  };

  const transactionIdField = useEap
    ? SpanIndexedField.TRANSACTION_SPAN_ID
    : SpanIndexedField.TRANSACTION_ID;

  const useIndexedCacheSpans = (
    isCacheHit: SpanIndexedResponse['cache.hit'],
    limit: number
  ) =>
    useSpansIndexed(
      {
        search: MutableSearch.fromQueryObject({
          ...sampleFilters,
          ...new MutableSearch(query.spanSearchQuery).filters,
          'cache.hit': isCacheHit,
        }),
        fields: [
          SpanIndexedField.PROJECT,
          SpanIndexedField.TRACE,
          SpanIndexedField.TRANSACTION_SPAN_ID,
          SpanIndexedField.SPAN_ID,
          SpanIndexedField.TIMESTAMP,
          SpanIndexedField.SPAN_DESCRIPTION,
          SpanIndexedField.CACHE_HIT,
          SpanIndexedField.SPAN_OP,
          SpanIndexedField.CACHE_ITEM_SIZE,
          SpanIndexedField.TRACE,
          ...(useEap ? [] : ([SpanIndexedField.TRANSACTION_ID] as const)),
        ],
        sorts: [SPAN_SAMPLES_SORT],
        limit,
      },
      Referrer.SAMPLES_CACHE_SPAN_SAMPLES
    );

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

  const cacheSamples = useMemo(() => {
    return [...(cacheHitSamples || []), ...(cacheMissSamples || [])];
  }, [cacheHitSamples, cacheMissSamples]);

  const transactionIds = cacheSamples?.map(span => span[transactionIdField]) || [];
  const traceIds = cacheSamples?.map(span => span.trace) || [];
  const transactionDurationSearch = useEap
    ? `${SpanIndexedField.TRANSACTION_SPAN_ID}:[${transactionIds.join(',')}] trace:[${traceIds.join(',')}] is_transaction:true`
    : `id:[${transactionIds.join(',')}]`;

  const {
    data: transactionData,
    error: transactionError,
    isFetching: isFetchingTransactions,
  } = useDiscoverOrEap(
    {
      search: transactionDurationSearch,
      enabled: Boolean(transactionIds.length),
      fields: ['id', 'timestamp', 'project', 'span.duration', 'trace'],
    },
    Referrer.SAMPLES_CACHE_SPAN_SAMPLES
  );

  const spansWithDuration = useMemo(() => {
    const transactionDurationsMap = keyBy(transactionData, 'id');
    return cacheSamples.map(span => ({
      ...span,
      'transaction.duration':
        transactionDurationsMap[span[transactionIdField]]?.['span.duration']!,
    }));
  }, [cacheSamples, transactionData, transactionIdField]);

  const spanSamplesById = useMemo(() => {
    return keyBy(spansWithDuration, 'id');
  }, [spansWithDuration]);

  const {projects} = useProjects();
  const project = projects.find(p => query.project === p.id);

  const handleSearch = (newSpanSearchQuery: string) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        spanSearchQuery: newSpanSearchQuery,
      },
    });
  };

  const handleRefetch = () => {
    refetchCacheHits();
    refetchCacheMisses();
  };

  const avg = transactionDurationData?.[0]?.[`avg(${SpanFields.SPAN_DURATION})`] ?? 0;

  const samplesPlottable = useMemo(() => {
    // Create a `TabularData` object from multiple datasets. This requires
    // setting the meta manually. A little annoying, but the meta is simple.
    const sampleData = {
      data: spansWithDuration,
      meta: {
        fields: {'span.duration': 'duration'},
        units: {'span.duration': DurationUnit.MILLISECOND},
      },
    } satisfies TabularData;

    return new Samples(sampleData, {
      attributeName: 'transaction.duration',
      baselineValue: avg,
      baselineLabel: t('Average'),
      onHighlight: sample => {
        setHighlightedSpanId(sample.id);
      },
      onDownplay: () => {
        setHighlightedSpanId(undefined);
      },
    });
  }, [avg, spansWithDuration, setHighlightedSpanId]);

  useEffect(() => {
    if (highlightedSpanId) {
      const spanSample = spanSamplesById[highlightedSpanId]!;
      samplesPlottable.highlight(spanSample);
    }

    return () => {
      if (!highlightedSpanId) {
        return;
      }

      const spanSample = spanSamplesById[highlightedSpanId]!;
      samplesPlottable?.downplay(spanSample);
    };
  }, [samplesPlottable, spanSamplesById, highlightedSpanId]);

  return (
    <PageAlertProvider>
      <InsightsSpanTagProvider>
        <EventDrawerHeader>
          <SampleDrawerHeaderTransaction
            project={project}
            transaction={query.transaction}
          />
        </EventDrawerHeader>

        <SampleDrawerBody>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ReadoutRibbon>
                <MetricReadout
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
                  title={getThroughputTitle('cache')}
                  value={cacheTransactionMetrics?.[0]?.[`${SpanFunction.EPM}()`]}
                  unit={RateUnit.PER_MINUTE}
                  isLoading={areCacheTransactionMetricsFetching}
                />

                <MetricReadout
                  title={DataTitles[`avg(${MetricsFields.TRANSACTION_DURATION})`]}
                  value={
                    transactionDurationData?.[0]?.[`avg(${SpanFields.SPAN_DURATION})`]
                  }
                  unit={DurationUnit.MILLISECOND}
                  isLoading={isTransactionDurationLoading}
                />

                <MetricReadout
                  title={DataTitles[`${SpanFunction.CACHE_MISS_RATE}()`]}
                  value={
                    cacheTransactionMetrics?.[0]?.[`${SpanFunction.CACHE_MISS_RATE}()`]
                  }
                  unit="percentage"
                  isLoading={areCacheTransactionMetricsFetching}
                />

                <MetricReadout
                  title={DataTitles.timeSpent}
                  value={cacheTransactionMetrics?.[0]?.['sum(span.self_time)']}
                  unit={DurationUnit.MILLISECOND}
                  isLoading={areCacheTransactionMetricsFetching}
                />
              </ReadoutRibbon>
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
              <CacheHitMissChart search={search} />
            </ModuleLayout.Half>
            <ModuleLayout.Half>
              <TransactionDurationChartWithSamples samples={samplesPlottable} />
            </ModuleLayout.Half>

            <ModuleLayout.Full>
              <SpanSearchQueryBuilder
                searchSource={`${ModuleName.CACHE}-sample-panel`}
                initialQuery={query.spanSearchQuery}
                onSearch={handleSearch}
                placeholder={t('Search for span attributes')}
                projects={selection.projects}
                useEap={useEap}
              />
            </ModuleLayout.Full>

            <Fragment>
              <ModuleLayout.Full>
                <SpanSamplesTable
                  data={spansWithDuration ?? []}
                  meta={{
                    // TODO: combine meta between samples and transactions response instead
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
        </SampleDrawerBody>
      </InsightsSpanTagProvider>
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

const useTransactionDuration = ({transaction}: {transaction: string}) => {
  const useEap = useInsightsEap();

  const metricsResult = useMetrics(
    {
      enabled: !useEap && Boolean(transaction),
      search: MutableSearch.fromQueryObject({
        transaction,
      } satisfies MetricsQueryFilters),
      fields: [`avg(${MetricsFields.TRANSACTION_DURATION})`],
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION
  );

  const eapResult = useEAPSpans(
    {
      search: MutableSearch.fromQueryObject({
        transaction,
        is_transaction: 'true',
      } satisfies SpanQueryFilters),
      fields: [`avg(${SpanFields.SPAN_DURATION})`],
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION
  );

  const result = useEap ? eapResult : metricsResult;
  const finalData: Array<{[`avg(span.duration)`]: number}> = useEap
    ? eapResult.data
    : metricsResult.data.map(row => ({
        'avg(span.duration)': row[`avg(${MetricsFields.TRANSACTION_DURATION})`],
      }));

  return {...result, data: finalData};
};
