import {
  useQuery,
  type QueryStatus,
  type QueryFunctionContext,
} from '@tanstack/react-query';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {decodeScalar} from 'sentry/utils/queryString';
import {useDefaultMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {EAPTraceMeta, ResponseEAPTraceMeta} from './types';

export type TraceMetaTrace = {timestamp: number | undefined; traceSlug: string};

type UseTraceMetaOptions = TraceMetaTrace | TraceMetaTrace[];

type TraceMetaQueryParams =
  | {include_uptime: string; statsPeriod: string}
  | {include_uptime: string; timestamp: number};

function isEmptyMeta(meta: EAPTraceMeta): boolean {
  return (
    meta.errorsCount === 0 &&
    meta.logsCount === 0 &&
    meta.metricsCount === 0 &&
    meta.performanceIssuesCount === 0 &&
    meta.spansCount === 0 &&
    meta.uptimeCount === 0
  );
}

function getMetaQueryParams(
  trace: TraceMetaTrace,
  normalizedParams: any,
  filters: Partial<PageFilters> = {},
  statsPeriodOverride?: string
): TraceMetaQueryParams {
  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

  return {
    include_uptime: '1',
    ...(trace.timestamp
      ? {timestamp: trace.timestamp}
      : {
          statsPeriod:
            statsPeriodOverride ??
            (statsPeriod || filters?.datetime?.period) ??
            DEFAULT_STATS_PERIOD,
        }),
  };
}

function mergeCountMap(acc: Record<string, number>, value: Record<string, number>): void {
  Object.entries(value).forEach(([key, count]) => {
    acc[key] = (acc[key] ?? 0) + count;
  });
}

type TransactionChildCountMap =
  | Record<string, number>
  | ResponseEAPTraceMeta['transactionChildCountMap'];

function mergeTransactionChildCountMap(
  acc: Record<string, number>,
  value: TransactionChildCountMap
): void {
  if (Array.isArray(value)) {
    value.forEach(row => {
      const id = row['transaction.event_id'];
      const count = row['count()'];

      if (!id) {
        return;
      }

      acc[id] = (acc[id] ?? 0) + count;
    });
    return;
  }

  mergeCountMap(acc, value);
}

async function fetchTraceMetaInBatches(
  organization: Organization,
  traces: TraceMetaTrace[],
  normalizedParams: any,
  fetchContext: QueryFunctionContext,
  filters: Partial<PageFilters> = {},
  statsPeriodOverride?: string
) {
  const pendingTraces = [...traces];
  const meta: EAPTraceMeta = {
    errorsCount: 0,
    logsCount: 0,
    metricsCount: 0,
    performanceIssuesCount: 0,
    spansCount: 0,
    spansCountMap: {},
    transactionChildCountMap: {},
    uptimeCount: 0,
  };

  const apiErrors: Error[] = [];

  while (pendingTraces.length > 0) {
    const batch = pendingTraces.splice(0, 3);
    const results = await Promise.allSettled<ResponseEAPTraceMeta>(
      batch.map(trace => {
        const url = getApiUrl(
          '/organizations/$organizationIdOrSlug/trace-meta/$traceId/',
          {path: {organizationIdOrSlug: organization.slug, traceId: trace.traceSlug}}
        );

        return apiFetch<ResponseEAPTraceMeta>({
          ...fetchContext,
          queryKey: [
            url,
            {
              method: 'GET',
              data: getMetaQueryParams(
                trace,
                normalizedParams,
                filters,
                statsPeriodOverride
              ),
            },
            {infinite: false},
          ],
        }).then(response => response.json);
      })
    );

    results.reduce((acc, result) => {
      if (result.status === 'fulfilled') {
        acc.errorsCount += result.value.errorsCount;
        acc.logsCount += result.value.logsCount;
        acc.metricsCount += result.value.metricsCount;
        acc.performanceIssuesCount += result.value.performanceIssuesCount;
        acc.spansCount += result.value.spansCount;
        acc.uptimeCount += result.value.uptimeCount ?? 0;
        mergeCountMap(acc.spansCountMap, result.value.spansCountMap);
        mergeTransactionChildCountMap(
          acc.transactionChildCountMap,
          result.value.transactionChildCountMap
        );
      } else {
        apiErrors.push(new Error(result?.reason));
      }
      return acc;
    }, meta);
  }

  return {meta, apiErrors};
}

export type TraceMetaQueryResults = {
  data: EAPTraceMeta | undefined;
  errors: Error[];
  isLoading: boolean;
  status: QueryStatus;
};

function getTraceMetaTraces(options: UseTraceMetaOptions): TraceMetaTrace[] {
  return Array.isArray(options) ? options : [options];
}

export function useTraceMeta(
  options: UseTraceMetaOptions,
  /**
   * `disableUrlSync` ignores the host page's query string. Waterfalls embedded in another page
   * (e.g. a Seer response) set this so a host `?statsPeriod=`/`?start=` cannot widen or narrow
   * the embed's meta window. It is part of the query key so an embed and the surrounding page
   * can ask about the same trace without sharing a cache entry.
   */
  {disableUrlSync = false}: {disableUrlSync?: boolean} = {}
): TraceMetaQueryResults {
  const filters = usePageFilters();
  const organization = useOrganization();
  const maxPickableDays = useDefaultMaxPickableDays();
  const traces = getTraceMetaTraces(options);

  const normalizedParams = normalizeDateTimeParams(
    disableUrlSync ? {} : qs.parse(location.search),
    {allowAbsolutePageDatetime: true}
  );

  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const {data, isLoading, status} = useQuery({
    queryKey: ['traceData', traces.map(trace => trace.traceSlug), disableUrlSync],
    queryFn: async context => {
      const result = await fetchTraceMetaInBatches(
        organization,
        traces,
        normalizedParams,
        context,
        filters.selection
      );

      const hasStatsPeriodTrace = traces.some(t => !t.timestamp);
      const defaultStatsDays = parseInt(DEFAULT_STATS_PERIOD, 10);
      if (
        result.apiErrors.length === 0 &&
        isEmptyMeta(result.meta) &&
        hasStatsPeriodTrace &&
        maxPickableDays > defaultStatsDays
      ) {
        return fetchTraceMetaInBatches(
          organization,
          traces,
          normalizedParams,
          context,
          filters.selection,
          `${maxPickableDays}d`
        );
      }

      return result;
    },
    staleTime: 1000 * 60 * 10,
    enabled: traces.length > 0,
  });

  const allRequestsFailed = data?.apiErrors.length === traces.length;

  return {
    data: allRequestsFailed ? undefined : data?.meta,
    errors: data?.apiErrors ?? [],
    status: allRequestsFailed ? 'error' : status,
    isLoading,
  };
}
