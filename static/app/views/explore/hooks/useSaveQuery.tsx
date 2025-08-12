import {useCallback, useMemo} from 'react';

import type {DateString} from 'sentry/types/core';
import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useLogsPageParams} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import {
  isGroupBy,
  isVisualize,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';

// Request payload type that matches the backend ExploreSavedQuerySerializer
type ExploreSavedQueryRequest = {
  dataset: 'logs' | 'spans' | 'segment_spans';
  name: string;
  projects: number[];
  end?: DateString;
  environment?: string[];
  interval?: string;
  query?: Array<{
    mode: Mode;
    aggregateField?: Array<{groupBy: string} | {yAxes: string[]; chartType?: number}>;
    aggregateOrderby?: string;
    fields?: string[];
    groupby?: string[];
    orderby?: string;
    query?: string;
    visualize?: Array<{
      yAxes: string[];
      chartType?: number;
    }>;
  }>;
  range?: string;
  start?: DateString;
};

export function useSpansSaveQuery() {
  const pageFilters = usePageFilters();
  const [interval] = useChartInterval();
  const exploreParams = useExplorePageParams();
  const {id, title} = exploreParams;

  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();

  const requestData = useMemo((): ExploreSavedQueryRequest => {
    return convertExplorePageParamsToRequest(
      exploreParams,
      pageFilters,
      interval,
      title ?? ''
    );
  }, [exploreParams, pageFilters, interval, title]);

  const {saveQueryApi, updateQueryApi} = useCreateOrUpdateSavedQuery(id);

  const saveQuery = useCallback(
    (newTitle: string, starred = true) => {
      return saveQueryApi({...requestData, name: newTitle}, starred);
    },
    [saveQueryApi, requestData]
  );

  const updateQuery = useCallback(() => {
    return updateQueryApi(requestData);
  }, [updateQueryApi, requestData]);

  return {saveQuery, updateQuery, saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}

function useCreateOrUpdateSavedQuery(id?: string) {
  const api = useApi();
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery(id);

  const saveQueryApi = useCallback(
    async (data: ExploreSavedQueryRequest, starred = true) => {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/explore/saved/`,
        {
          method: 'POST',
          data: {
            ...data,
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
    async (data: ExploreSavedQueryRequest) => {
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
  const pageFilters = usePageFilters();
  const [interval] = useChartInterval();
  const logsParams = useLogsPageParams();
  const {id, title} = logsParams;

  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();

  const requestData = useMemo((): ExploreSavedQueryRequest => {
    return convertLogsPageParamsToRequest(logsParams, pageFilters, interval, title ?? '');
  }, [logsParams, pageFilters, interval, title]);

  const {saveQueryApi, updateQueryApi} = useCreateOrUpdateSavedQuery(id);

  const saveQuery = useCallback(
    (newTitle: string, starred = true) => {
      return saveQueryApi({...requestData, name: newTitle}, starred);
    },
    [saveQueryApi, requestData]
  );

  const updateQuery = useCallback(() => {
    return updateQueryApi(requestData);
  }, [updateQueryApi, requestData]);

  return {saveQuery, updateQuery, saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}

function convertExplorePageParamsToRequest(
  exploreParams: ReturnType<typeof useExplorePageParams>,
  pageFilters: ReturnType<typeof usePageFilters>,
  interval: string,
  title: string
): ExploreSavedQueryRequest {
  const {selection} = pageFilters;
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;

  const {aggregateFields, sortBys, fields, query, mode} = exploreParams;

  const transformedAggregateFields = aggregateFields
    .filter(aggregateField => {
      if (isGroupBy(aggregateField)) {
        return aggregateField.groupBy !== '';
      }
      return true;
    })
    .map(aggregateField => {
      return isVisualize(aggregateField)
        ? {
            yAxes: [aggregateField.yAxis],
            chartType: aggregateField.chartType,
          }
        : {groupBy: aggregateField.groupBy};
    });

  return {
    name: title,
    projects,
    dataset: 'spans',
    start,
    end,
    range: period ?? undefined,
    environment: environments,
    interval,
    query: [
      {
        fields,
        orderby: sortBys[0] ? encodeSort(sortBys[0]) : undefined,
        query: query ?? '',
        aggregateField: transformedAggregateFields,
        mode,
      },
    ],
  };
}

function convertLogsPageParamsToRequest(
  logsParams: ReturnType<typeof useLogsPageParams>,
  pageFilters: ReturnType<typeof usePageFilters>,
  interval: string,
  title: string
): ExploreSavedQueryRequest {
  const {selection} = pageFilters;
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;

  const {sortBys, fields, search, mode, groupBy, aggregateFn, aggregateParam} =
    logsParams;
  const query = search?.formatString() ?? '';

  const aggregate =
    aggregateFn && aggregateParam ? `${aggregateFn}(${aggregateParam})` : undefined;
  const visualize = aggregate
    ? [
        {
          yAxes: [aggregate],
        },
      ]
    : undefined;

  return {
    name: title,
    projects,
    dataset: 'logs',
    start,
    end,
    range: period ?? undefined,
    environment: environments,
    interval,
    query: [
      {
        fields,
        orderby: sortBys[0] ? encodeSort(sortBys[0]) : undefined,
        query,
        groupby: groupBy ? [groupBy] : undefined,
        mode,
        visualize,
      },
    ],
  };
}
