import {useCallback, useMemo} from 'react';

import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  logsPageParamsToAggregateFields,
  useLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import type {AggregateField} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {
  isGroupBy,
  isVisualize,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  type SavedQuery,
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface SaveQueryParams {
  aggregateFields: AggregateField[];
  fields: string[];
  mode: Mode;
  query: string;
  sortBys: Sort[];
  aggregateFn?: string;
  aggregateParam?: string;
  groupBy?: string;
  id?: string;
  title?: string;
}

function usePageParamsForDataset(dataset: TraceItemDataset): SaveQueryParams {
  const explorePageParams = useExplorePageParams();
  const logsPageParams = useLogsPageParams();

  if (dataset === TraceItemDataset.LOGS) {
    return {
      aggregateFields: logsPageParamsToAggregateFields(
        logsPageParams.groupBy,
        logsPageParams.aggregateFn,
        logsPageParams.aggregateParam
      ),
      fields: logsPageParams.fields,
      sortBys: logsPageParams.sortBys,
      query: logsPageParams.search?.formatString() ?? '',
      mode: logsPageParams.mode,
      id: logsPageParams.id,
      title: logsPageParams.title,
      groupBy: logsPageParams.groupBy,
      aggregateFn: logsPageParams.aggregateFn,
      aggregateParam: logsPageParams.aggregateParam,
    };
  }

  return {
    aggregateFields: explorePageParams.aggregateFields,
    fields: explorePageParams.fields,
    sortBys: explorePageParams.sortBys,
    query: explorePageParams.query,
    mode: explorePageParams.mode,
    id: explorePageParams.id,
    title: explorePageParams.title,
  };
}

export function useSaveQuery(dataset: TraceItemDataset) {
  const {selection} = usePageFilters();
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;
  const [interval] = useChartInterval();

  const {aggregateFields, sortBys, fields, query, mode, id, title} =
    usePageParamsForDataset(dataset);

  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery(id);

  const data = useMemo(() => {
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

export function useLogsSaveQuery() {
  return useSaveQuery(TraceItemDataset.LOGS);
}
