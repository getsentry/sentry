import {useCallback, useMemo} from 'react';
import {useMutation} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import type {DateString} from 'sentry/types/core';
import type {SavedQuery as OrganizationSavedQuery} from 'sentry/types/organization';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  useInvalidateSavedQueries,
  useInvalidateSavedQuery,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';
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
  dataset:
    | 'logs'
    | 'spans'
    | 'segment_spans'
    | 'metrics'
    | 'replays'
    | 'ai_conversations';
  name: string;
  projects: number[];
  changedReason?: ExploreQueryChangedReason;
  crossEvents?: CrossEvent[];
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

function useSavedQueryForDataset(
  dataset: 'spans' | 'logs' | 'replays',
  overrides?: {
    pageFilters?: ReturnType<typeof usePageFilters>;
    queryParams?: ReadableQueryParams;
  }
) {
  const currentPageFilters = usePageFilters();
  const [interval] = useChartInterval();
  const currentQueryParams = useQueryParams();
  const pageFilters = overrides?.pageFilters ?? currentPageFilters;
  const queryParams = overrides?.queryParams ?? currentQueryParams;
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
      return saveQueryApi({data: {...requestData, name: newTitle}, starred});
    },
    [saveQueryApi, requestData]
  );

  const updateQuery = useCallback(() => {
    return updateQueryApi(requestData);
  }, [updateQueryApi, requestData]);

  return {saveQuery, updateQuery, saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}

function useCreateOrUpdateSavedQuery(id?: string) {
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const invalidateSavedQuery = useInvalidateSavedQuery(id);

  const {mutateAsync: saveQueryApi} = useMutation({
    mutationFn: ({data, starred}: {data: ExploreSavedQueryRequest; starred: boolean}) =>
      fetchMutation<OrganizationSavedQuery>({
        url: `/organizations/${organization.slug}/explore/saved/`,
        method: 'POST',
        data: {...data, starred},
      }),
    onSuccess: () => {
      invalidateSavedQueries();
      invalidateSavedQuery();
    },
  });

  const {mutateAsync: updateQueryApi} = useMutation({
    mutationFn: (data: ExploreSavedQueryRequest) =>
      fetchMutation<OrganizationSavedQuery>({
        url: `/organizations/${organization.slug}/explore/saved/${id}/`,
        method: 'PUT',
        data: {
          ...data,
          dataset: data.dataset === 'segment_spans' ? 'spans' : data.dataset,
        },
      }),
    onSuccess: () => {
      invalidateSavedQueries();
      invalidateSavedQuery();
    },
  });

  return {saveQueryApi, updateQueryApi};
}

/**
 * For updating or duplicating queries, agnostic to dataset since it's operating on existing data
 */
export function useFromSavedQuery() {
  const organization = useOrganization();
  const invalidateSavedQueries = useInvalidateSavedQueries();

  const {mutateAsync: saveQueryFromSavedQuery} = useMutation({
    mutationFn: (savedQuery: SavedQuery) =>
      fetchMutation<OrganizationSavedQuery>({
        url: `/organizations/${organization.slug}/explore/saved/`,
        method: 'POST',
        data: {
          ...savedQuery,
          // we want to make sure no new queries are saved with the segment_spans dataset
          dataset: savedQuery.dataset === 'segment_spans' ? 'spans' : savedQuery.dataset,
        },
      }),
    onSuccess: () => {
      invalidateSavedQueries();
    },
  });

  const {mutateAsync: updateQueryFromSavedQuery} = useMutation({
    mutationFn: (savedQuery: SavedQuery) =>
      fetchMutation<OrganizationSavedQuery>({
        url: `/organizations/${organization.slug}/explore/saved/${savedQuery.id}/`,
        method: 'PUT',
        data: {
          ...savedQuery,
          // we want to make sure queries are locked in as spans once they're updated
          dataset: savedQuery.dataset === 'segment_spans' ? 'spans' : savedQuery.dataset,
        },
      }),
    onSuccess: () => {
      invalidateSavedQueries();
    },
  });

  return {saveQueryFromSavedQuery, updateQueryFromSavedQuery};
}

export function useSpansSaveQuery(overrides?: {
  pageFilters?: ReturnType<typeof usePageFilters>;
  queryParams?: ReadableQueryParams;
}) {
  return useSavedQueryForDataset('spans', overrides);
}

export function useLogsSaveQuery() {
  return useSavedQueryForDataset('logs');
}

export function useReplaySaveQuery() {
  return useSavedQueryForDataset('replays');
}

function convertQueryParamsToRequest({
  dataset,
  queryParams,
  pageFilters,
  interval,
  title,
  caseInsensitive,
}: {
  dataset: 'spans' | 'logs' | 'replays';
  interval: string;
  pageFilters: ReturnType<typeof usePageFilters>;
  queryParams: ReadableQueryParams;
  title: string;
  caseInsensitive?: '1';
}): ExploreSavedQueryRequest {
  const {selection} = pageFilters;
  const {datetime, projects, environments} = selection;
  const {start, end, period} = datetime;

  const {sortBys, fields, search, mode, crossEvents} = queryParams;
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
    crossEvents: crossEvents?.length ? [...crossEvents] : undefined,
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
