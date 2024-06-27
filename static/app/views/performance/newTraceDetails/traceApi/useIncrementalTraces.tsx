import {useEffect, useMemo, useState} from 'react';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TraceDataRow} from 'sentry/views/replays/detail/trace/replayTransactionContext';

import {TraceTree} from '../traceModels/traceTree';

import {getTraceQueryParams} from './useTrace';

export function fetchSingleTrace(
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
            return fetchSingleTrace(api, {
              orgSlug: organization.slug,
              query: qs.stringify(
                getTraceQueryParams(
                  urlParams,
                  filters.selection,
                  traceLimit,
                  batchTraceData
                )
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
