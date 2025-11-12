import type React from 'react';
import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import type {TracePeriod} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsSearch,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
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
    return undefined;
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

  return (
    <Fragment>
      <SearchQueryBuilder
        placeholder={t('Search metrics for this trace')}
        filterKeys={{}}
        getTagValues={() => new Promise<string[]>(() => [])}
        initialQuery={metricsSearch.formatString()}
        searchSource="tracemetrics"
        onSearch={query => setMetricsQuery(query)}
      />
      <TableContainer>
        <MetricsSamplesTable embedded />
      </TableContainer>
    </Fragment>
  );
}

const TableContainer = styled('div')`
  margin-top: ${space(2)};
`;

const StyledPanel = styled(Panel)`
  padding: ${space(2)};
  margin: 0;
`;
