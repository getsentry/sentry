import {useEffect, useMemo, useState} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TraceDataRow} from 'sentry/views/replays/detail/trace/replayTransactionContext';

import {TraceTree} from '../traceModels/traceTree';

export function fetchTrace(
  api: Client,
  params: {
    orgSlug: string;
    query: string;
    traceId: string;
  }
): Promise<TraceSplitResults<TraceFullDetailed>> {
  return api.requestPromise(
    `/organizations/${params.orgSlug}/events-trace/${params.traceId}/?${params.query}`
  );
}

const DEFAULT_TIMESTAMP_LIMIT = 10_000;
const DEFAULT_LIMIT = 1_000;

export function getSingleTraceQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {},
  traceLimit: number | undefined,
  traceDataRow: TraceDataRow
): string {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });
  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const demo = decodeScalar(normalizedParams.demo);
  let decodedLimit: string | number | undefined =
    traceLimit ?? decodeScalar(normalizedParams.limit);

  if (typeof decodedLimit === 'string') {
    decodedLimit = parseInt(decodedLimit, 10);
  }

  const eventId = decodeScalar(normalizedParams.eventId);

  if (traceDataRow?.timestamp) {
    decodedLimit = decodedLimit ?? DEFAULT_TIMESTAMP_LIMIT;
  } else {
    decodedLimit = decodedLimit ?? DEFAULT_LIMIT;
  }

  const limit = decodedLimit;

  const otherParams: Record<string, string | string[] | undefined | null> = {
    end: normalizedParams.pageEnd,
    start: normalizedParams.pageStart,
    statsPeriod: statsPeriod || filters.datetime?.period,
  };

  // We prioritize timestamp over statsPeriod as it makes the query more specific, faster
  // and not prone to time drift issues.
  if (traceDataRow?.timestamp) {
    delete otherParams.statsPeriod;
  }

  const queryParams = {
    ...otherParams,
    demo,
    limit,
    timestamp: traceDataRow?.timestamp?.toString(),
    eventId,
    useSpans: 1,
  };
  for (const key in queryParams) {
    if (
      queryParams[key] === '' ||
      queryParams[key] === null ||
      queryParams[key] === undefined
    ) {
      delete queryParams[key];
    }
  }

  return qs.stringify(queryParams);
}

type TraceQueryResults = {
  errors: Error[];
  isIncrementallyFetching: boolean;
};

export function useIncrementalTraces(
  tree: TraceTree,
  traceDataRows: TraceDataRow[] | undefined,
  traceLimit?: number
): TraceQueryResults {
  const filters = usePageFilters();
  const api = useApi();
  const organization = useOrganization();
  const urlParams = useMemo(() => {
    return qs.parse(location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [traceData, setTraceData] = useState<{
    errors: Error[];
    isIncrementallyFetching: boolean;
  }>({
    errors: [],
    isIncrementallyFetching: true,
  });

  useEffect(() => {
    async function fetchTracesInBatches() {
      if (!traceDataRows || traceDataRows.length === 0 || tree.type !== 'trace') {
        return;
      }

      const clonedTraceIds = [...traceDataRows.slice(1)];
      const apiErrors: Error[] = [];

      while (clonedTraceIds.length > 0) {
        const batch = clonedTraceIds.splice(0, 3);
        const results = await Promise.allSettled(
          batch.map(batchTraceData => {
            return fetchTrace(api, {
              orgSlug: organization.slug,
              query: getSingleTraceQueryParams(
                urlParams,
                filters.selection,
                traceLimit,
                batchTraceData
              ),
              traceId: batchTraceData.traceSlug,
            });
          })
        );

        const updatedData = results.reduce(
          (acc, result) => {
            if (result.status === 'fulfilled') {
              const {transactions, orphan_errors} = result.value;
              acc.transactions.push(...transactions);
              acc.orphan_errors.push(...orphan_errors);
            } else {
              apiErrors.push(new Error(result.reason));
            }
            return acc;
          },
          {
            transactions: [],
            orphan_errors: [],
          } as TraceSplitResults<TraceTree.Transaction>
        );

        tree.appendTree(TraceTree.FromTrace(updatedData, null));
        setTraceData(prev => ({
          ...prev,
          isIncrementallyFetching: true,
        }));
      }

      setTraceData({isIncrementallyFetching: false, errors: apiErrors});
    }

    fetchTracesInBatches();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traceDataRows, tree]);

  return traceData;
}
