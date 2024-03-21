import {useMemo} from 'react';
import type {Location} from 'history';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {PageFilters} from 'sentry/types';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';

function getMetaQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {}
): {
  project: string;
  statsPeriod: string | undefined;
  timestamp: string | undefined;
} {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });
  let statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const project = decodeScalar(normalizedParams.project, ALL_ACCESS_PROJECTS + '');
  const timestamp = decodeScalar(normalizedParams.timestamp);

  if (statsPeriod === undefined && !timestamp && filters.datetime?.period) {
    statsPeriod = filters.datetime.period;
  }

  return {statsPeriod, project, timestamp};
}

type UseTraceMetaParams = {
  referrer?: string;
};

const DEFAULT_OPTIONS = {};
export function useTraceMeta(
  options: Partial<UseTraceMetaParams> = DEFAULT_OPTIONS
): UseApiQueryResult<TraceMeta | null, any> {
  const filters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const queryParams = useMemo(() => {
    return getMetaQueryParams(location.query, filters.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useApiQuery(
    [
      `/organizations/${organization.slug}/events-trace-meta/${params.traceSlug ?? ''}/`,
      {
        query: options.referrer
          ? {...queryParams, refferrer: options.referrer}
          : queryParams,
      },
    ],
    {
      staleTime: Infinity,
      enabled: !!params.traceSlug && !!organization.slug,
    }
  );
}
