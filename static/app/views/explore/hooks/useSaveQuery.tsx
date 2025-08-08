import {useCallback, useMemo} from 'react';

import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useLogsPageParams} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import {
  type AggregateField,
  isGroupBy,
  isVisualize,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  type RawGroupBy,
  type RawVisualize,
  type SavedQuery,
  SavedQueryQuery,
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function useSaveQuery(dataset: TraceItemDataset) {
  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const {aggregateFields, sortBys, fields, query, mode, id, title} =
    useExplorePageParams();

  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();

  const data = useMemo((): SavedQuery => {
    return {
      name: title ?? '',
      dataset,
      start,
      end,
      range: period ?? undefined,
      interval,
      projects,
      environment: environments,
      query: [
        new SavedQueryQuery({
          aggregateField: aggregateFieldsToRaw(aggregateFields),
          fields,
          orderby: sortBys[0] ? encodeSort(sortBys[0]) : '',
          query: query ?? '',
          mode,
        }),
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
    dataset,
  ]);

  const {saveQueryApi, updateQueryApi} = useCreateOrUpdateSavedQuery(id);

  const saveQuery = useCallback(
    (newTitle: string, starred = true) => {
      return saveQueryApi(data, newTitle, starred);
    },
    [saveQueryApi, data]
  );

  const updateQuery = useCallback(() => {
    return updateQueryApi(data);
  }, [updateQueryApi, data]);

  return {saveQuery, updateQuery, saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}

export function useCreateOrUpdateSavedQuery(id?: string) {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery(id);
  const saveQueryApi = useCallback(
    async (data: SavedQuery, newTitle: string, starred = true) => {
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
    [api, organization.slug, invalidateSavedQueries, invalidateSavedQuery]
  );

  const updateQueryApi = useCallback(
    async (data: SavedQuery) => {
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
    },
    [api, organization.slug, id, invalidateSavedQueries, invalidateSavedQuery]
  );

  return {saveQueryApi, updateQueryApi};
}

/**
 * For updating or duplicating queries, agnostic to dataset since it's operating on existing data
 */
export function useFromSavedQuery() {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

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

  return {saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}

export function useLogsSaveQuery() {
  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const {sortBys, fields, search, mode, id, title, groupBy, search, aggregate} =
    useLogsPageParams();
  const query = search?.formatString();

  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();

  const data = useMemo((): SavedQuery => {
    return {
      name: title,
      dataset,
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
    dataset,
  ]);

  const {saveQueryApi, updateQueryApi} = useCreateOrUpdateSavedQuery(id);

  const saveQuery = useCallback(
    (newTitle: string, starred = true) => {
      return saveQueryApi(data, newTitle, starred);
    },
    [saveQueryApi, data]
  );

  const updateQuery = useCallback(() => {
    return updateQueryApi(data);
  }, [updateQueryApi, data]);

  return {saveQuery, updateQuery, saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}

function aggregateFieldsToRaw(
  aggregateFields: AggregateField[]
): Array<RawVisualize | RawGroupBy> {
  return aggregateFields.map(aggregateField => {
    if (isVisualize(aggregateField)) {
      return aggregateField.toJSON();
    }
    if (isGroupBy(aggregateField)) {
      return aggregateField.toJSON();
    }
    return aggregateField.toJSON();
  });
}
