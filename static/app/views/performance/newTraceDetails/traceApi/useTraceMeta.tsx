import {useMemo} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';

function getMetaQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {}
):
  | {
      sampleSlug: string | undefined;
      statsPeriod: string;
    }
  | {
      sampleSlug: string | undefined;
      timestamp: string;
    } {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });

  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const timestamp = decodeScalar(normalizedParams.timestamp);

  if (timestamp) {
    return {timestamp, sampleSlug: decodeScalar(normalizedParams.sampleSlug)};
  }

  return {
    statsPeriod: (statsPeriod || filters?.datetime?.period) ?? DEFAULT_STATS_PERIOD,
    sampleSlug: decodeScalar(normalizedParams.sampleSlug),
  };
}

export function useTraceMeta(
  traceSlug?: string
): UseApiQueryResult<TraceMeta | null, any> {
  const filters = usePageFilters();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const queryParams = useMemo(() => {
    const query = qs.parse(location.search);
    return getMetaQueryParams(query, filters.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sampleSlug = queryParams.sampleSlug;
  const trace = traceSlug ?? params.traceSlug;

  const traceMetaQueryResults = useApiQuery<TraceMeta>(
    [
      `/organizations/${organization.slug}/events-trace-meta/${trace ?? ''}/`,
      {query: queryParams},
    ],
    {
      staleTime: Infinity,
      enabled: !!trace && !!organization.slug,
    }
  );

  // When projects don't have performance set up, we allow them to view a sample transaction.
  // Now that a transaction always shows up as a part of the trace it is associate with, we
  // we need to display it as a part of the trace view. Therefore, we fetch the sample transaction
  // make a trace, with it as the only event in it. The trace meta query has to reflect this by returning
  // a single transaction and project.
  if (sampleSlug) {
    return {
      data: {
        errors: 0,
        performance_issues: 0,
        projects: 1,
        transactions: 1,
      },
      isLoading: false,
    } as UseApiQueryResult<TraceMeta | null, any>;
  }

  return traceMetaQueryResults;
}
