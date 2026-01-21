import {Fragment, useEffect, useMemo, useState} from 'react';
import keyBy from 'lodash/keyBy';

import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {EventDrawerHeader} from 'sentry/components/events/eventDrawer';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {
  EMPTY_OPTION_VALUE,
  escapeFilterValue,
  MutableSearch,
} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';
import {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {computeAxisMax} from 'sentry/views/insights/common/components/chart';
// TODO(release-drawer): Move InsightsLineChartWidget into separate, self-contained component
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {SampleDrawerHeaderTransaction} from 'sentry/views/insights/common/components/sampleDrawerHeaderTransaction';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  DataTitles,
  getDurationChartTitle,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {ResponseCodeCountChart} from 'sentry/views/insights/http/components/charts/responseCodeCountChart';
import {SpanSamplesTable} from 'sentry/views/insights/http/components/tables/spanSamplesTable';
import {HTTP_RESPONSE_STATUS_CODES} from 'sentry/views/insights/http/data/definitions';
import {useSpanSamples} from 'sentry/views/insights/http/queries/useSpanSamples';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';
import decodePanel from 'sentry/views/insights/http/utils/queryParameterDecoders/panel';
import decodeResponseCodeClass from 'sentry/views/insights/http/utils/queryParameterDecoders/responseCodeClass';
import {InsightsSpanTagProvider} from 'sentry/views/insights/pages/insightsSpanTagProvider';
import {
  ModuleName,
  SpanFields,
  SpanFunction,
  type SpanQueryFilters,
} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

interface HTTPSamplesPanelSearchQueryBuilderProps {
  handleSearch: (query: string) => void;
  query: string;
  selection: PageFilters;
}

function HTTPSamplesPanelSearchQueryBuilder({
  query,
  selection,
  handleSearch,
}: HTTPSamplesPanelSearchQueryBuilderProps) {
  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects: selection.projects,
    initialQuery: query,
    onSearch: handleSearch,
    placeholder: t('Search for span attributes'),
    searchSource: `${ModuleName.HTTP}-sample-panel`,
  });

  return <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />;
}

export function HTTPSamplesPanel() {
  const navigate = useNavigate();
  const location = useLocation();

  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      domain: decodeScalar,
      transaction: decodeScalar,
      transactionMethod: decodeScalar,
      panel: decodePanel,
      responseCodeClass: decodeResponseCodeClass,
      spanSearchQuery: decodeScalar,
      [SpanFields.USER_GEO_SUBREGION]: decodeList,
    },
  });

  const organization = useOrganization();

  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const project = projects.find(p => query.project === p.id);

  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );

  // `detailKey` controls whether the panel is open. If all required properties are available, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey = query.transaction
    ? [query.domain, query.transactionMethod, query.transaction].filter(Boolean).join(':')
    : undefined;

  const handlePanelChange = (newPanelName: any) => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'panel',
      new_state: newPanelName,
      organization,
      source: ModuleName.HTTP,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        panel: newPanelName,
      },
    });
  };

  const handleResponseCodeClassChange = (newResponseCodeClass: any) => {
    trackAnalytics('performance_views.sample_spans.filter_updated', {
      filter: 'status_code',
      new_state: newResponseCodeClass.value,
      organization,
      source: ModuleName.HTTP,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        responseCodeClass: newResponseCodeClass.value,
      },
    });
  };

  const isPanelOpen = Boolean(detailKey);

  const ADDITONAL_FILTERS = {
    'span.domain':
      query.domain === '' ? EMPTY_OPTION_VALUE : escapeFilterValue(query.domain),
    transaction: query.transaction,
    ...(query[SpanFields.USER_GEO_SUBREGION].length > 0
      ? {
          [SpanFields.USER_GEO_SUBREGION]: `[${query[SpanFields.USER_GEO_SUBREGION].join(',')}]`,
        }
      : {}),
  };

  // The ribbon is above the data selectors, and not affected by them. So, it has its own filters.
  const ribbonFilters: SpanQueryFilters = {
    ...BASE_FILTERS,
    ...ADDITONAL_FILTERS,
    ...new MutableSearch(query.spanSearchQuery).filters,
  };

  // These filters are for the charts and samples tables
  const filters: SpanQueryFilters = {
    ...BASE_FILTERS,
    ...ADDITONAL_FILTERS,
    ...new MutableSearch(query.spanSearchQuery).filters,
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
  } = useSpans(
    {
      search: MutableSearch.fromQueryObject(ribbonFilters),
      fields: [
        `${SpanFunction.EPM}()`,
        `avg(${SpanFields.SPAN_SELF_TIME})`,
        `sum(${SpanFields.SPAN_SELF_TIME})`,
        'http_response_rate(3)',
        'http_response_rate(4)',
        'http_response_rate(5)',
      ],
      enabled: isPanelOpen,
    },
    Referrer.SAMPLES_PANEL_METRICS_RIBBON
  );

  const {
    isFetching: isDurationDataFetching,
    data: durationData,
    error: durationError,
  } = useFetchSpanTimeSeries(
    {
      query: search,
      yAxis: [`avg(span.self_time)`],
      enabled: isPanelOpen && query.panel === 'duration',
    },
    Referrer.SAMPLES_PANEL_DURATION_CHART
  );

  const timeSeries = durationData?.timeSeries || [];
  const durationSeries = timeSeries.find(ts => ts.yAxis === 'avg(span.self_time)');

  const {
    isFetching: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useFetchSpanTimeSeries(
    {
      query: search,
      groupBy: [SpanFields.SPAN_STATUS_CODE],
      yAxis: ['count()'],
      topEvents: 5,
      sort: {
        kind: 'desc',
        field: 'count()',
      },
      enabled: isPanelOpen && query.panel === 'status',
    },
    Referrer.SAMPLES_PANEL_RESPONSE_CODE_CHART
  );

  const responseCodeTimeSeries = responseCodeData?.timeSeries || [];

  const durationAxisMax = computeAxisMax([
    durationSeries
      ? {
          seriesName: durationSeries.yAxis,
          data: durationSeries.values.map(v => ({
            name: v.timestamp,
            value: v.value || 0,
          })),
        }
      : {
          seriesName: 'avg(span.self_time)',
          data: [],
        },
  ]);

  const {
    data: spanSamplesData,
    isFetching: isDurationSamplesDataFetching,
    error: durationSamplesDataError,
    refetch: refetchDurationSpanSamples,
  } = useSpanSamples({
    search,
    fields: [
      SpanFields.ID,
      SpanFields.TRACE,
      SpanFields.SPAN_DESCRIPTION,
      SpanFields.SPAN_STATUS_CODE,
    ],
    min: 0,
    max: durationAxisMax,
    enabled: isPanelOpen && query.panel === 'duration' && durationAxisMax > 0,
    referrer: Referrer.SAMPLES_PANEL_DURATION_SAMPLES,
  });

  const spanSamplesById = useMemo(() => {
    return keyBy(spanSamplesData?.data ?? [], 'id');
  }, [spanSamplesData]);

  const {
    data: responseCodeSamplesData,
    isFetching: isResponseCodeSamplesDataFetching,
    error: responseCodeSamplesDataError,
    refetch: refetchResponseCodeSpanSamples,
  } = useSpans(
    {
      search,
      fields: [
        SpanFields.PROJECT,
        SpanFields.TRACE,
        SpanFields.TRANSACTION_SPAN_ID,
        SpanFields.SPAN_ID,
        SpanFields.TIMESTAMP,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.SPAN_STATUS_CODE,
      ],
      sorts: [SPAN_SAMPLES_SORT],
      limit: SPAN_SAMPLE_LIMIT,
      enabled: isPanelOpen && query.panel === 'status',
    },
    Referrer.SAMPLES_PANEL_RESPONSE_CODE_SAMPLES
  );

  const handleSearch = (newSpanSearchQuery: string) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        spanSearchQuery: newSpanSearchQuery,
      },
    });

    if (query.panel === 'duration') {
      refetchDurationSpanSamples();
    } else {
      refetchResponseCodeSpanSamples();
    }
  };

  const avg = domainTransactionMetrics?.[0]?.['avg(span.self_time)'] ?? 0;

  const samplesPlottable = useMemo(() => {
    if (!spanSamplesData) {
      return undefined;
    }

    return new Samples(spanSamplesData as TabularData, {
      attributeName: 'span.self_time',
      baselineValue: avg,
      baselineLabel: t('Average'),
      onHighlight: sample => {
        setHighlightedSpanId(sample.id);
      },
      onDownplay: () => {
        setHighlightedSpanId(undefined);
      },
    });
  }, [avg, spanSamplesData, setHighlightedSpanId]);

  useEffect(() => {
    if (highlightedSpanId && samplesPlottable) {
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
            transactionMethod={query.transactionMethod}
          />
        </EventDrawerHeader>

        <SampleDrawerBody>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ReadoutRibbon>
                <MetricReadout
                  title={getThroughputTitle('http')}
                  value={domainTransactionMetrics?.[0]?.[`${SpanFunction.EPM}()`]}
                  unit={RateUnit.PER_MINUTE}
                  isLoading={areDomainTransactionMetricsFetching}
                />

                <MetricReadout
                  title={DataTitles.avg}
                  value={
                    domainTransactionMetrics?.[0]?.[`avg(${SpanFields.SPAN_SELF_TIME})`]
                  }
                  unit={DurationUnit.MILLISECOND}
                  isLoading={areDomainTransactionMetricsFetching}
                />

                <MetricReadout
                  title={t('3XXs')}
                  value={domainTransactionMetrics?.[0]?.[`http_response_rate(3)`]}
                  unit="percentage"
                  isLoading={areDomainTransactionMetricsFetching}
                />

                <MetricReadout
                  title={t('4XXs')}
                  value={domainTransactionMetrics?.[0]?.[`http_response_rate(4)`]}
                  unit="percentage"
                  isLoading={areDomainTransactionMetricsFetching}
                />

                <MetricReadout
                  title={t('5XXs')}
                  value={domainTransactionMetrics?.[0]?.[`http_response_rate(5)`]}
                  unit="percentage"
                  isLoading={areDomainTransactionMetricsFetching}
                />

                <MetricReadout
                  title={DataTitles.timeSpent}
                  value={domainTransactionMetrics?.[0]?.['sum(span.self_time)']}
                  unit={DurationUnit.MILLISECOND}
                  isLoading={areDomainTransactionMetricsFetching}
                />
              </ReadoutRibbon>
            </ModuleLayout.Full>

            <ModuleLayout.Full>
              <Flex justify="between" gap="xl">
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
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      prefix={t('Response Code')}
                    />
                  )}
                />
              </Flex>
            </ModuleLayout.Full>

            {query.panel === 'duration' && (
              <Fragment>
                <ModuleLayout.Full>
                  <InsightsLineChartWidget
                    showLegend="never"
                    queryInfo={{
                      search,
                      referrer: Referrer.SAMPLES_PANEL_DURATION_CHART,
                    }}
                    title={getDurationChartTitle('http')}
                    isLoading={isDurationDataFetching}
                    error={durationError}
                    timeSeries={durationSeries ? [durationSeries] : []}
                    samples={samplesPlottable}
                  />
                </ModuleLayout.Full>
              </Fragment>
            )}

            {query.panel === 'status' && (
              <Fragment>
                <ModuleLayout.Full>
                  <ResponseCodeCountChart
                    search={search}
                    referrer={Referrer.SAMPLES_PANEL_RESPONSE_CODE_CHART}
                    groupBy={[SpanFields.SPAN_STATUS_CODE]}
                    series={responseCodeTimeSeries}
                    isLoading={isResponseCodeDataLoading}
                    error={responseCodeError}
                  />
                </ModuleLayout.Full>
              </Fragment>
            )}

            <ModuleLayout.Full>
              <HTTPSamplesPanelSearchQueryBuilder
                query={query.spanSearchQuery}
                selection={selection}
                handleSearch={handleSearch}
              />
            </ModuleLayout.Full>

            {query.panel === 'duration' && (
              <Fragment>
                <ModuleLayout.Full>
                  <SpanSamplesTable
                    data={spanSamplesData?.data ?? []}
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
                    referrer={TraceViewSources.REQUESTS_MODULE}
                  />
                </ModuleLayout.Full>

                <ModuleLayout.Full>
                  <Button
                    onClick={() => {
                      trackAnalytics(
                        'performance_views.sample_spans.try_different_samples_clicked',
                        {organization, source: ModuleName.HTTP}
                      );
                      refetchDurationSpanSamples();
                    }}
                  >
                    {t('Try Different Samples')}
                  </Button>
                </ModuleLayout.Full>
              </Fragment>
            )}

            {query.panel === 'status' && (
              <Fragment>
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
                  <Button
                    onClick={() => {
                      trackAnalytics(
                        'performance_views.sample_spans.try_different_samples_clicked',
                        {organization, source: ModuleName.HTTP}
                      );
                      refetchResponseCodeSpanSamples();
                    }}
                  >
                    {t('Try Different Samples')}
                  </Button>
                </ModuleLayout.Full>
              </Fragment>
            )}
          </ModuleLayout.Layout>
        </SampleDrawerBody>
      </InsightsSpanTagProvider>
    </PageAlertProvider>
  );
}

const SPAN_SAMPLE_LIMIT = 10;

// This is functionally a random sort, which is what we want
const SPAN_SAMPLES_SORT = {
  field: 'span_id',
  kind: 'desc' as const,
};

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
