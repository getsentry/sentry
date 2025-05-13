import {useCallback, useMemo} from 'react';

import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {getTitleFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/title';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {MAX_QUERIES_ALLOWED} from 'sentry/views/explore/multiQueryMode/content';
import {useReadQueriesFromLocation} from 'sentry/views/explore/multiQueryMode/locationUtils';

const TRACE_EXPLORER_DATASET = 'spans';

export function useSaveMultiQuery() {
  const location = useLocation();
  const id = getIdFromLocation(location);
  const title = getTitleFromLocation(location);

  const queries = useReadQueriesFromLocation().slice(0, MAX_QUERIES_ALLOWED);

  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

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
        fields: q.fields,
        orderby: q.sortBys[0] ? encodeSort(q.sortBys[0]) : undefined, // Explore only handles a single sort by
        groupby: q.groupBys.filter(groupBy => groupBy !== ''),
        query: q.query ?? '',
        visualize: [{yAxes: q.yAxes, chartType: q.chartType}],
        mode: q.groupBys.length > 0 ? 'aggregate' : 'samples',
      })),
    };
  }, [title, start, end, period, interval, projects, environments, queries]);

  const saveQuery = useCallback(
    async (newTitle: string, starred = true) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/`,
        {
          method: 'POST',
          data: {
            ...data,
            name: newTitle,
            starred,
          },
        }
      );
      invalidateSavedQueries();
      return response;
    },
    [api, organization.slug, data, invalidateSavedQueries]
  );

  const updateQuery = useCallback(async () => {
    const response = await api.requestPromise(
      `/organizations/${organization.slug}/explore/saved/${id}/`,
      {
        method: 'PUT',
        data,
      }
    );
    return response;
  }, [api, organization.slug, id, data]);

  return {saveQuery, updateQuery};
}
