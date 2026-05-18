import {useQuery, type QueryStatus} from '@tanstack/react-query';
import type {QueryFunctionContext} from '@tanstack/react-query';
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
import {useIsEAPTraceEnabled} from 'sentry/views/performance/newTraceDetails/useIsEAPTraceEnabled';

import type {
  EAPTraceMeta,
  ResponseEAPTraceMeta,
  ResponseTraceMeta,
  TraceMeta,
} from './types';

export type TraceMetaTrace = {
  timestamp: number | undefined;
  traceSlug: string;
};

type UseTraceMetaOptions = TraceMetaTrace | TraceMetaTrace[];

type TraceMetaQueryParams =
  | {
      include_uptime: string;
      statsPeriod: string;
    }
  | {
      include_uptime: string;
      timestamp: number;
    };

function isEmptyMeta(meta: TraceMeta | EAPTraceMeta): boolean {
  return (
    getTraceMetaSpanCount(meta) === 0 &&
    getTraceMetaErrorCount(meta) === 0 &&
    getTraceMetaPerformanceIssueCount(meta) === 0
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

type MetaArg = TraceMeta | EAPTraceMeta | null | undefined;
type ResponseMetaArg = ResponseTraceMeta | ResponseEAPTraceMeta | null | undefined;

function isEAPTraceMeta(meta: MetaArg): meta is EAPTraceMeta {
  if (!meta) return false;
  return 'uptimeCount' in meta && !('transactions' in meta);
}

function isResponseEAPTraceMeta(meta: ResponseMetaArg): meta is ResponseEAPTraceMeta {
  if (!meta) return false;
  return 'spansCount' in meta;
}

export function getTraceMetaErrorCount(meta: MetaArg) {
  if (!meta) return;
  return isEAPTraceMeta(meta) ? meta.errorsCount : meta.errors;
}

export function getTraceMetaPerformanceIssueCount(meta: MetaArg) {
  if (!meta) return;
  return isEAPTraceMeta(meta) ? meta.performanceIssuesCount : meta.performance_issues;
}

export function getTraceMetaSpanCount(meta: MetaArg) {
  if (!meta) return;
  return isEAPTraceMeta(meta) ? meta.spansCount : meta.span_count;
}

export function getTraceMetaLogsCount(meta: MetaArg) {
  if (!meta) return;
  return isEAPTraceMeta(meta) ? meta.logsCount : undefined;
}

export function getTraceMetaTransactionChildCountMap(meta: MetaArg) {
  if (!meta) return;
  return isEAPTraceMeta(meta)
    ? meta.transactionChildCountMap
    : meta.transaction_child_count_map;
}

function mergeCountMap(acc: Record<string, number>, value: Record<string, number>): void {
  Object.entries(value).forEach(([key, count]) => {
    acc[key] = (acc[key] ?? 0) + count;
  });
}

type TransactionChildCountMap =
  | Record<string, number>
  | ResponseTraceMeta['transaction_child_count_map']
  | ResponseEAPTraceMeta['transactionChildCountMap'];

function mergeTransactionChildCountMap(
  acc: Record<string, number>,
  value: TransactionChildCountMap
): void {
  if (Array.isArray(value)) {
    value.forEach(row => {
      const id =
        'transaction.id' in row ? row['transaction.id'] : row['transaction.event_id'];
      const count = 'count' in row ? row.count : row['count()'];

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
  type: 'non-eap' | 'eap',
  organization: Organization,
  traces: TraceMetaTrace[],
  normalizedParams: any,
  fetchContext: QueryFunctionContext,
  filters: Partial<PageFilters> = {},
  statsPeriodOverride?: string
) {
  const pendingTraces = [...traces];
  const meta: TraceMeta | EAPTraceMeta =
    type === 'eap'
      ? {
          errorsCount: 0,
          logsCount: 0,
          metricsCount: 0,
          performanceIssuesCount: 0,
          spansCount: 0,
          spansCountMap: {},
          transactionChildCountMap: {},
          uptimeCount: 0,
        }
      : {
          errors: 0,
          performance_issues: 0,
          projects: 0,
          transactions: 0,
          transaction_child_count_map: {},
          span_count: 0,
          span_count_map: {},
        };

  const apiErrors: Error[] = [];

  while (pendingTraces.length > 0) {
    const batch = pendingTraces.splice(0, 3);
    const results = await Promise.allSettled<ResponseTraceMeta | ResponseEAPTraceMeta>(
      batch.map(trace => {
        const url = getApiUrl(
          type === 'non-eap'
            ? '/organizations/$organizationIdOrSlug/events-trace-meta/$traceId/'
            : '/organizations/$organizationIdOrSlug/trace-meta/$traceId/',
          {path: {organizationIdOrSlug: organization.slug, traceId: trace.traceSlug}}
        );

        return apiFetch<ResponseTraceMeta | ResponseEAPTraceMeta>({
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
        if (isEAPTraceMeta(acc)) {
          if (!isResponseEAPTraceMeta(result.value)) {
            return acc;
          }

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

          return acc;
        }

        if (isResponseEAPTraceMeta(result.value)) {
          return acc;
        }

        acc.errors += result.value.errors;
        acc.performance_issues += result.value.performance_issues;
        acc.projects = Math.max(acc.projects, result.value.projects);
        acc.transactions += result.value.transactions;
        acc.span_count += result.value.span_count;
        mergeCountMap(acc.span_count_map, result.value.span_count_map);
        mergeTransactionChildCountMap(
          acc.transaction_child_count_map,
          result.value.transaction_child_count_map
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
  data: TraceMeta | EAPTraceMeta | undefined;
  errors: Error[];
  isLoading: boolean;
  status: QueryStatus;
};

function getTraceMetaTraces(options: UseTraceMetaOptions): TraceMetaTrace[] {
  return Array.isArray(options) ? options : [options];
}

export function useTraceMeta(options: UseTraceMetaOptions): TraceMetaQueryResults {
  const filters = usePageFilters();
  const organization = useOrganization();
  const isEAP = useIsEAPTraceEnabled();
  const maxPickableDays = useDefaultMaxPickableDays();
  const traces = getTraceMetaTraces(options);

  const normalizedParams = normalizeDateTimeParams(qs.parse(location.search), {
    allowAbsolutePageDatetime: true,
  });

  // demo has the format ${projectSlug}:${eventId}
  // used to query a demo transaction event from the backend.
  const mode = decodeScalar(normalizedParams.demo) ? 'demo' : undefined;

  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const {data, isLoading, status} = useQuery({
    queryKey: ['traceData', traces.map(trace => trace.traceSlug)],
    queryFn: async context => {
      const result = await fetchTraceMetaInBatches(
        isEAP ? 'eap' : 'non-eap',
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
          isEAP ? 'eap' : 'non-eap',
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

  /**
   * When projects don't have performance set up, we allow them to view a sample
   * transaction. The backend creates the sample transaction, however the trace is
   * created async, so when the page loads, we cannot guarantee that querying the trace
   * will succeed as it may not have been stored yet. When this happens, we assemble a
   * fake trace response to only include the transaction that had already been created
   * and stored already so that the users can visualize in the context of a trace. The
   * trace meta query has to reflect this by returning a single transaction and project.
   */
  if (mode === 'demo') {
    return {
      errors: [],
      status: 'success' as QueryStatus,
      isLoading: false,
      data: isEAP
        ? {
            errorsCount: 0,
            logsCount: 0,
            metricsCount: 0,
            performanceIssuesCount: 0,
            spansCount: 0,
            spansCountMap: {},
            transactionChildCountMap: {},
            uptimeCount: 0,
          }
        : {
            errors: 0,
            performance_issues: 0,
            projects: 1,
            transactions: 1,
            transaction_child_count_map: {},
            span_count: 0,
            span_count_map: {},
          },
    };
  }

  return {
    data: data?.meta,
    errors: data?.apiErrors ?? [],
    status: data?.apiErrors?.length === traces.length ? 'error' : status,
    isLoading,
  };
}
