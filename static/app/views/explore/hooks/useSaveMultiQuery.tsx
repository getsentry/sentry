import {useMemo} from 'react';
import {useMutation} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {MAX_QUERIES_ALLOWED} from 'sentry/views/explore/multiQueryMode/content';
import {useReadQueriesFromLocation} from 'sentry/views/explore/multiQueryMode/locationUtils';

const TRACE_EXPLORER_DATASET = 'spans';

export function useSaveMultiQuery() {
  const location = useLocation();
  const id = decodeScalar(location.query.id);
  const title = decodeScalar(location.query.title);

  const queries = useReadQueriesFromLocation().slice(0, MAX_QUERIES_ALLOWED);

  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery(id);

  const data = useMemo(() => {
    return {
      name: title,
      isMultiQuery: true,
      dataset: TRACE_EXPLORER_DATASET, // Only supported for trace explorer for now
      start,
      end,
      range: period,
      interval,
      projects,
      environment: environments,
      query: queries.map(q => ({
        aggregateField: [
          ...q.groupBys.filter(groupBy => groupBy !== '').map(groupBy => ({groupBy})),
          {yAxes: q.yAxes, chartType: q.chartType},
        ],
        fields: q.fields,
        orderby: q.sortBys[0] ? encodeSort(q.sortBys[0]) : undefined, // Explore only handles a single sort by
        query: q.query ?? '',
        mode: q.groupBys.length > 0 ? 'aggregate' : 'samples',
        caseInsensitive: q.caseInsensitive ? '1' : undefined,
      })),
    };
  }, [title, start, end, period, interval, projects, environments, queries]);

  const {mutateAsync: saveQuery} = useMutation({
    mutationFn: ({name, starred = true}: {name: string; starred?: boolean}) =>
      fetchMutation<{id: string}>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {
          ...data,
          name,
          starred,
        },
      }),
    onSuccess: () => {
      invalidateSavedQueries();
    },
  });

  const {mutateAsync: updateQuery} = useMutation({
    mutationFn: () =>
      fetchMutation<{id: string}>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/$id/', {
          path: {organizationIdOrSlug: organization.slug, id: String(id)},
        }),
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      invalidateSavedQueries();
      invalidateSavedQuery();
    },
  });

  return {saveQuery, updateQuery};
}
