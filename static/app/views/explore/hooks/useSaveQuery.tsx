import {useCallback, useMemo} from 'react';

import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import {
  isGroupBy,
  isVisualize,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  type SavedQuery,
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

const TRACE_EXPLORER_DATASET = 'spans';

export function useSaveQuery() {
  const {aggregateFields, sortBys, fields, query, mode, id, title} =
    useExplorePageParams();
  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery(id);

  const data = useMemo(() => {
    return {
      name: title,
      dataset: TRACE_EXPLORER_DATASET, // Only supported for trace explorer for now
      start,
      end,
      range: period,
      interval,
      projects,
      environment: environments,
      query: [
        {
          aggregateField: aggregateFields
            .filter(aggregateField => {
              if (isGroupBy(aggregateField)) {
                return aggregateField.groupBy !== '';
              }
              return true;
            })
            .map(aggregateField => {
              return isVisualize(aggregateField)
                ? aggregateField.toJSON()
                : aggregateField;
            }),
          fields,
          orderby: sortBys[0] ? encodeSort(sortBys[0]) : undefined,
          query: query ?? '',
          mode,
        },
      ],
    };
  }, [
    aggregateFields,
    sortBys,
    fields,
    query,
    mode,
    start,
    end,
    period,
    interval,
    projects,
    environments,
    title,
  ]);

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
      invalidateSavedQuery();
      return response;
    },
    [api, organization.slug, data, invalidateSavedQueries, invalidateSavedQuery]
  );

  const updateQuery = useCallback(async () => {
    const response = await api.requestPromise(
      `/organizations/${organization.slug}/explore/saved/${id}/`,
      {
        method: 'PUT',
        data,
      }
    );
    invalidateSavedQueries();
    invalidateSavedQuery();
    return response;
  }, [api, organization.slug, id, data, invalidateSavedQueries, invalidateSavedQuery]);

  const saveQueryFromSavedQuery = useCallback(
    async (savedQuery: SavedQuery) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/`,
        {
          method: 'POST',
          data: {
            ...savedQuery,
          },
        }
      );
      invalidateSavedQueries();
      return response;
    },
    [api, organization.slug, invalidateSavedQueries]
  );

  const updateQueryFromSavedQuery = useCallback(
    async (savedQuery: SavedQuery) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/${savedQuery.id}/`,
        {
          method: 'PUT',
          data: {
            ...savedQuery,
          },
        }
      );
      invalidateSavedQueries();
      return response;
    },
    [api, organization.slug, invalidateSavedQueries]
  );

  return {saveQuery, updateQuery, saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}
