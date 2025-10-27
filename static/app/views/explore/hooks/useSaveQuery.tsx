import {useCallback, useMemo} from 'react';

import type {DateString} from 'sentry/types/core';
import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useExplorePageParams} from 'sentry/views/explore/contexts/pageParamsContext';
import {
  isGroupBy as isLegacyGroupBy,
  isVisualize as isLegacyVisualize,
} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';

export type ExploreQueryChangedReason = {
  columns: string[];
  equations: Array<{
    equation: string;
    reason: string | string[];
  }> | null;
  orderby: Array<{
    orderby: string;
    reason: string | string[];
  }> | null;
};

// Request payload type that matches the backend ExploreSavedQuerySerializer
type ExploreSavedQueryRequest = {
  dataset: 'logs' | 'spans' | 'segment_spans';
  name: string;
  projects: number[];
  changedReason?: ExploreQueryChangedReason;
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
          data: {
            ...data,
            dataset: data.dataset === 'segment_spans' ? 'spans' : data.dataset,
          },
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
            // we want to make sure no new queries are saved with the segment_spans dataset
            dataset:
              savedQuery.dataset === 'segment_spans' ? 'spans' : savedQuery.dataset,
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
            // we want to make sure queries are locked in as spans once they're updated
            dataset:
              savedQuery.dataset === 'segment_spans' ? 'spans' : savedQuery.dataset,
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
  const queryParams = useQueryParams();
  const {id, title} = queryParams;

  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();

  const requestData = useMemo((): ExploreSavedQueryRequest => {
    return convertLogsPageParamsToRequest({
      queryParams,
      pageFilters,
      interval,
      title: title ?? '',
    });
  }, [queryParams, pageFilters, interval, title]);

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
      if (isLegacyGroupBy(aggregateField)) {
        return aggregateField.groupBy !== '';
      }
      return true;
    })
    .map(aggregateField => {
      if (isLegacyVisualize(aggregateField)) {
        const json = aggregateField.toJSON();
        return {
          ...json,
          yAxes: [...json.yAxes],
        };
      }
      return {groupBy: aggregateField.groupBy};
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

function convertLogsPageParamsToRequest({
  queryParams,
  pageFilters,
  interval,
  title,
}: {
  interval: string;
  pageFilters: ReturnType<typeof usePageFilters>;
  queryParams: ReadableQueryParams;
  title: string;
}): ExploreSavedQueryRequest {
  const {selection} = pageFilters;
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;

  const {sortBys, fields, search, mode} = queryParams;
  const query = search?.formatString() ?? '';

  const aggregateFields = queryParams.aggregateFields
    .filter(aggregateField => {
      if (isGroupBy(aggregateField)) {
        return Boolean(aggregateField.groupBy);
      }
      return true;
    })
    .map(aggregateField => {
      if (isGroupBy(aggregateField)) {
        return {groupBy: aggregateField.groupBy};
      }

      if (isVisualize(aggregateField)) {
        const serialized = aggregateField.serialize();
        return {
          ...serialized,
          yAxes: [...serialized.yAxes],
        };
      }

      throw new Error(`Unknown aggregate field: ${JSON.stringify(aggregateField)}`);
    });

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
        mode,
        aggregateField: aggregateFields,
      },
    ],
  };
}
