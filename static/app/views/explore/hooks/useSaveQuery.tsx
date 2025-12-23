import {useCallback, useMemo} from 'react';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import type {DateString} from 'sentry/types/core';
import {encodeSort} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
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

type ExploreSavedQueryRequest = {
  dataset: 'logs' | 'spans' | 'segment_spans' | 'metrics';
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
    caseInsensitive?: '1';
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

function useSavedQueryForDataset(dataset: 'spans' | 'logs') {
  const pageFilters = usePageFilters();
  const [interval] = useChartInterval();
  const queryParams = useQueryParams();
  const {id, title} = queryParams;

  const [caseInsensitive] = useCaseInsensitivity();
  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();

  const requestData = useMemo((): ExploreSavedQueryRequest => {
    return convertQueryParamsToRequest({
      dataset,
      queryParams,
      pageFilters,
      interval,
      title: title ?? '',
      caseInsensitive: caseInsensitive ? '1' : undefined,
    });
  }, [dataset, queryParams, pageFilters, interval, title, caseInsensitive]);

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

export function useSpansSaveQuery() {
  return useSavedQueryForDataset('spans');
}

export function useLogsSaveQuery() {
  return useSavedQueryForDataset('logs');
}

function convertQueryParamsToRequest({
  dataset,
  queryParams,
  pageFilters,
  interval,
  title,
  caseInsensitive,
}: {
  dataset: 'spans' | 'logs';
  interval: string;
  pageFilters: ReturnType<typeof usePageFilters>;
  queryParams: ReadableQueryParams;
  title: string;
  caseInsensitive?: '1';
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
    dataset,
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
        caseInsensitive,
      },
    ],
  };
}
