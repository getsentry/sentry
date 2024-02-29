import {useEffect, useMemo, useState} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {PageFilters} from 'sentry/types';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
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
) {
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

type RequestState<T> = {
  data: T | null;
  status: 'resolved' | 'pending' | 'error' | 'initial';
  error?: Error | null;
};

const DEFAULT_OPTIONS = {};
export function useTrace(
  options: Partial<UseTraceParams> = DEFAULT_OPTIONS
): RequestState<TraceSplitResults<TraceFullDetailed> | null> {
  const api = useApi();
  const filters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const [trace, setTrace] = useState<
    RequestState<TraceSplitResults<TraceFullDetailed> | null>
  >({
    status: 'initial',
    data: null,
  });

  const queryParams = useMemo(() => {
    return getTraceQueryParams(location.query, filters.selection, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  useEffect(() => {
    if (!params.traceSlug) {
      return undefined;
    }

    let unmounted = false;

    setTrace({
      status: 'pending',
      data: null,
    });

    fetchTrace(api, {
      traceId: params.traceSlug,
      orgSlug: organization.slug,
      query: qs.stringify(queryParams),
    })
      .then(resp => {
        if (unmounted) return;
        setTrace({
          status: 'resolved',
          data: resp,
        });
      })
      .catch(e => {
        if (unmounted) return;
        setTrace({
          status: 'error',
          data: null,
          error: e,
        });
      });

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug, params.traceSlug, queryParams]);

  return trace;
}
