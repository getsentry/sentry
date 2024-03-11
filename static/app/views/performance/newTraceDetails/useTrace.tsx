import {useMemo} from 'react';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {PageFilters} from 'sentry/types';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';

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

export function getTraceQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {},
  options: {limit?: number} = {}
): {
  limit: number;
  project: string;
  statsPeriod: string | undefined;
  timestamp: string | undefined;
  useSpans: number;
} {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });
  let statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const project = decodeScalar(normalizedParams.project, ALL_ACCESS_PROJECTS + '');
  const timestamp = decodeScalar(normalizedParams.timestamp);
  let decodedLimit: string | number | undefined =
    options.limit ?? decodeScalar(normalizedParams.limit);

  if (typeof decodedLimit === 'string') {
    decodedLimit = parseInt(decodedLimit, 10);
  }

  if (timestamp) {
    decodedLimit = decodedLimit ?? DEFAULT_TIMESTAMP_LIMIT;
  } else {
    decodedLimit = decodedLimit ?? DEFAULT_LIMIT;
  }

  const limit = decodedLimit;

  if (statsPeriod === undefined && !timestamp && filters.datetime?.period) {
    statsPeriod = filters.datetime.period;
  }

  return {limit, statsPeriod, project, timestamp, useSpans: 1};
}

type UseTraceParams = {
  limit?: number;
};

const DEFAULT_OPTIONS = {};
export function useTrace(
  options: Partial<UseTraceParams> = DEFAULT_OPTIONS
): UseApiQueryResult<TraceSplitResults<TraceFullDetailed>, any> {
  const filters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const queryParams = useMemo(() => {
    return getTraceQueryParams(location.query, filters.selection, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  return useApiQuery(
    [
      `/organizations/${organization.slug}/events-trace/${params.traceSlug ?? ''}/`,
      {query: queryParams},
    ],
    {
      staleTime: Infinity,
      enabled: !!params.traceSlug && !!organization.slug,
    }
  );
}
