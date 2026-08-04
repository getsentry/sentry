import type React from 'react';
import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {HiddenTraceMetricTraceViewSearchFields} from 'sentry/views/explore/metrics/constants';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {
  useMetricsFrozenSearch,
  useMetricsFrozenTracePeriod,
  type TracePeriod,
} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {
  useQueryParamsSearch,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

type UseTraceViewMetricsDataProps = {
  children: React.ReactNode;
  traceSlug: string;
};

export function TraceViewMetricsProviderWrapper({
  children,
  traceSlug,
}: UseTraceViewMetricsDataProps) {
  const queryParams = useTraceQueryParams();

  const tracePeriod: TracePeriod | undefined = useMemo(() => {
    // If timestamp is available, create a +-3 hour window around it
    if (queryParams.timestamp) {
      const timestampMs = queryParams.timestamp * 1000;
      const threeHoursMs = 3 * 60 * 60 * 1000;
      const start = new Date(timestampMs - threeHoursMs).toISOString();
      const end = new Date(timestampMs + threeHoursMs).toISOString();
      return {
        start,
        end,
        period: null,
      };
    }

    // Fallback to existing period logic if no timestamp
    if (queryParams.start || queryParams.end || queryParams.statsPeriod) {
      return {
        start: queryParams.start,
        end: queryParams.end,
        period: queryParams.statsPeriod,
      };
    }
    return;
  }, [
    queryParams.timestamp,
    queryParams.start,
    queryParams.end,
    queryParams.statsPeriod,
  ]);

  return (
    <MetricsQueryParamsProvider
      queryParams={
        new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.SAMPLES,
          query: '',
          cursor: '',
          fields: ['id', 'timestamp'],
          sortBys: [{field: 'timestamp', kind: 'desc'}],
          aggregateCursor: '',
          aggregateFields: [],
          aggregateSortBys: [],
        })
      }
      setQueryParams={() => {}}
      traceMetric={{name: '', type: ''}}
      setTraceMetric={() => {}}
      removeMetric={() => {}}
      freeze={{
        traceIds: [traceSlug],
        tracePeriod,
      }}
      isStateBased
    >
      {children}
    </MetricsQueryParamsProvider>
  );
}

export function TraceViewMetricsSection() {
  return (
    <StyledPanel>
      <MetricsSectionContent />
    </StyledPanel>
  );
}

function MetricsSectionContent() {
  const setMetricsQuery = useSetQueryParamsQuery();
  const metricsSearch = useQueryParamsSearch();
  const frozenSearch = useMetricsFrozenSearch();
  const frozenTracePeriod = useMetricsFrozenTracePeriod();
  const {selection} = usePageFilters();
  const initialQuery = metricsSearch.formatString();
  const placeholder = t('Search application metrics for this trace');
  const attributeQuery = frozenSearch?.formatString();
  const datetime = useMemo(
    () =>
      frozenTracePeriod
        ? {
            start: frozenTracePeriod.start ?? null,
            end: frozenTracePeriod.end ?? null,
            period: frozenTracePeriod.period ?? null,
            utc: selection.datetime.utc,
          }
        : undefined,
    [frozenTracePeriod, selection.datetime.utc]
  );

  const traceMetricsSearchQueryBuilderProps = useMemo(() => {
    const numberAttributes: TagCollection = {};
    const numberSecondaryAliases: TagCollection = {};
    const booleanAttributes: TagCollection = {};
    const booleanSecondaryAliases: TagCollection = {};
    const stringSecondaryAliases: TagCollection = {};

    const stringAttributes: TagCollection = {
      [TraceMetricKnownFieldKey.METRIC_NAME]: {
        key: TraceMetricKnownFieldKey.METRIC_NAME,
        name: TraceMetricKnownFieldKey.METRIC_NAME,
        kind: FieldKind.TAG,
      },
      [TraceMetricKnownFieldKey.METRIC_TYPE]: {
        key: TraceMetricKnownFieldKey.METRIC_TYPE,
        name: TraceMetricKnownFieldKey.METRIC_TYPE,
        kind: FieldKind.TAG,
      },
      [TraceMetricKnownFieldKey.METRIC_UNIT]: {
        key: TraceMetricKnownFieldKey.METRIC_UNIT,
        name: TraceMetricKnownFieldKey.METRIC_UNIT,
        kind: FieldKind.TAG,
      },
    };

    return {
      itemType: TraceItemDataset.TRACEMETRICS,
      booleanAttributes,
      numberAttributes,
      stringAttributes,
      booleanSecondaryAliases,
      numberSecondaryAliases,
      stringSecondaryAliases,
      initialQuery,
      placeholder,
      searchSource: 'tracemetrics',
      onSearch: (query: string) => setMetricsQuery(query),
      hiddenAttributeKeys: HiddenTraceMetricTraceViewSearchFields,
      attributeQuery,
      disableRecentSearches: true,
      datetime,
    };
  }, [attributeQuery, datetime, initialQuery, placeholder, setMetricsQuery]);

  const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps(
    traceMetricsSearchQueryBuilderProps
  );

  return (
    <Fragment>
      <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
        <TraceItemSearchQueryBuilder {...traceMetricsSearchQueryBuilderProps} />
      </SearchQueryBuilderProvider>
      <TableContainer>
        <MetricsSamplesTable source="traceWaterfall" />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const StyledPanel = styled(Panel)`
  padding: ${p => p.theme.space.xl};
  margin: 0;
`;
