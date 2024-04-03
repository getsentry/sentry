import {useMemo} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
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
      project: string;
      statsPeriod: string;
    }
  | {project: string; timestamp: string} {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });

  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const project = decodeScalar(normalizedParams.project, ALL_ACCESS_PROJECTS + '');
  const timestamp = decodeScalar(normalizedParams.timestamp);

  if (timestamp) {
    return {project, timestamp};
  }

  return {
    statsPeriod: (statsPeriod || filters?.datetime?.period) ?? DEFAULT_STATS_PERIOD,
    project,
  };
}

export function useTraceMeta(): UseApiQueryResult<TraceMeta | null, any> {
  const filters = usePageFilters();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const queryParams = useMemo(() => {
    const query = qs.parse(location.search);
    return getMetaQueryParams(query, filters.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useApiQuery(
    [
      `/organizations/${organization.slug}/events-trace-meta/${params.traceSlug ?? ''}/`,
      {query: queryParams},
    ],
    {
      staleTime: Infinity,
      enabled: !!params.traceSlug && !!organization.slug,
    }
  );
}
