import {useCallback, useMemo} from 'react';
import {skipToken, useQuery, useQueryClient} from '@tanstack/react-query';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {DateString} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {ExploreQueryChangedReason} from 'sentry/views/explore/hooks/useSaveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

export type RawGroupBy = {
  groupBy: string;
};

function isRawGroupBy(value: any): value is RawGroupBy {
  return typeof value === 'object' && typeof value.groupBy === 'string';
}

export type RawVisualize = {
  yAxes: string[];
  chartType?: number;
};

export function isRawVisualize(value: any): value is RawVisualize {
  return (
    typeof value === 'object' &&
    Array.isArray(value.yAxes) &&
    value.yAxes.every((v: any) => typeof v === 'string')
  );
}

type ReadableQuery = {
  fields: string[];
  mode: Mode;
  orderby: string;
  query: string;
  // a query can have either
  // - `aggregateField` which contains a list of group bys and visualizes merged together
  // - `groupby` and `visualize` which contains the group bys and visualizes separately
  aggregateField?: Array<RawGroupBy | RawVisualize>;
  aggregateOrderby?: string;
  caseInsensitive?: CaseInsensitive;

  groupby?: string[];
  // Only used for metrics dataset.
  metric?: TraceMetric;
  visualize?: RawVisualize[];
};

// This is the `query` property on our SavedQuery, which indicates the actualy query portion of the saved query, hence SavedQueryQuery.
class SavedQueryQuery {
  fields: string[];
  mode: Mode;
  orderby: string;
  query: string;
  caseInsensitive?: CaseInsensitive;
  aggregateField: Array<RawGroupBy | RawVisualize>;
  aggregateOrderby?: string;
  groupby: string[];
  visualize: RawVisualize[];

  metric?: TraceMetric; // Only used for metrics dataset.

  constructor(query: ReadableQuery) {
    this.metric = query.metric;
    this.fields = query.fields;
    this.mode = query.mode;
    this.orderby = query.orderby;
    this.query = query.query;
    this.caseInsensitive = query.caseInsensitive;
    this.aggregateOrderby = query.aggregateOrderby;
    // for compatibility, we ensure that aggregate fields, group bys and visualizes are all populated
    // we ensure that group bys + visualizes = aggregate fields
    this.groupby =
      query.aggregateField
        ?.filter<RawGroupBy>(isRawGroupBy)
        .map(groupBy => groupBy.groupBy) ??
      query.groupby ??
      [];
    this.visualize =
      query.aggregateField?.filter<RawVisualize>(isRawVisualize) ?? query.visualize ?? [];
    this.aggregateField = defined(query.aggregateField)
      ? query.aggregateField
      : [...this.groupby.map(groupBy => ({groupBy})), ...this.visualize];
  }
}

export type SortOption =
  | 'name'
  | '-name'
  | 'dateAdded'
  | '-dateAdded'
  | '-dateUpdated'
  | 'mostPopular'
  | 'recentlyViewed'
  | 'starred'
  | 'mostStarred';

// Comes from ExploreSavedQueryModelSerializer
export type ReadableSavedQuery = {
  dataset: 'logs' | 'spans' | 'segment_spans' | 'metrics' | 'replays'; // ExploreSavedQueryDataset
  dateAdded: string;
  dateUpdated: string;
  id: number;
  interval: string;
  lastVisited: string;
  name: string;
  position: number | null;
  projects: number[];
  query: [ReadableQuery, ...ReadableQuery[]];
  starred: boolean;
  caseInsensitive?: CaseInsensitive;
  changedReason?: ExploreQueryChangedReason | null;
  createdBy?: User;
  end?: string;
  environment?: string[];
  isPrebuilt?: boolean;
  range?: string;
  start?: string;
};

export class SavedQuery {
  dateAdded: string;
  dateUpdated: string;
  id: number;
  interval: string;
  lastVisited: string;
  name: string;
  position: number | null;
  projects: number[];
  query: [SavedQueryQuery, ...SavedQueryQuery[]];
  dataset: ReadableSavedQuery['dataset'];
  starred: boolean;
  changedReason?: ExploreQueryChangedReason | null;
  createdBy?: User;
  end?: string | DateString;
  environment?: string[];
  isPrebuilt?: boolean;
  range?: string;
  start?: string | DateString;

  constructor(savedQuery: ReadableSavedQuery) {
    this.changedReason = savedQuery.changedReason;
    this.dateAdded = savedQuery.dateAdded;
    this.dateUpdated = savedQuery.dateUpdated;
    this.id = savedQuery.id;
    this.interval = savedQuery.interval;
    this.lastVisited = savedQuery.lastVisited;
    this.name = savedQuery.name;
    this.position = savedQuery.position;
    this.projects = savedQuery.projects;
    this.query = [
      new SavedQueryQuery(savedQuery.query[0]),
      ...savedQuery.query.slice(1).map(q => new SavedQueryQuery(q)),
    ];
    this.starred = savedQuery.starred;
    this.createdBy = savedQuery.createdBy;
    this.end = savedQuery.end;
    this.environment = savedQuery.environment;
    this.isPrebuilt = savedQuery.isPrebuilt;
    this.range = savedQuery.range;
    this.start = savedQuery.start;
    this.dataset = savedQuery.dataset;
  }
}

export function getSavedQueryTraceItemDataset(dataset: ReadableSavedQuery['dataset']) {
  return DATASET_TO_TRACE_ITEM_DATASET_MAP[dataset];
}

export const MAX_STARRED_SAVED_QUERIES_IN_NAV = 20;

function savedQueriesApiOptions<TData = ReadableSavedQuery[]>(
  organization: Organization,
  query?: Record<string, unknown>
) {
  return apiOptions.as<TData>()('/organizations/$organizationIdOrSlug/explore/saved/', {
    path: {organizationIdOrSlug: organization.slug},
    query,
    staleTime: 0,
  });
}

export function starredSavedQueriesApiOptions(organization: Organization) {
  return savedQueriesApiOptions<SavedQuery[]>(organization, {
    per_page: MAX_STARRED_SAVED_QUERIES_IN_NAV,
    starred: 1,
  });
}

type Props = {
  cursor?: string;
  exclude?: 'owned' | 'shared';
  perPage?: number;
  query?: string;
  sortBy?: SortOption[];
  starred?: boolean;
};

export function useGetSavedQueries({
  sortBy,
  exclude,
  starred,
  perPage = 5,
  cursor,
  query,
}: Props) {
  const organization = useOrganization();

  const {data, isLoading, isFetched, isError} = useQuery({
    ...savedQueriesApiOptions(organization, {
      sortBy,
      exclude,
      per_page: perPage,
      starred: starred ? 1 : undefined,
      cursor,
      query,
    }),
    select: selectJsonWithHeaders,
  });

  const pageLinks = data?.headers.Link;

  const savedQueries = useMemo(
    () =>
      data?.json
        ?.filter(q => Array.isArray(q.query) && q.query.length > 0)
        .map(q => new SavedQuery(q)),
    [data?.json]
  );
  return {data: savedQueries, isLoading, pageLinks, isFetched, isError};
}

export function useInvalidateSavedQueries() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(() => {
    const baseKey = savedQueriesApiOptions(organization).queryKey;
    queryClient.invalidateQueries({queryKey: baseKey});
  }, [queryClient, organization]);
}

function savedQueryApiOptions({
  organization,
  id,
}: {
  id: string | undefined;
  organization: Organization;
}) {
  return apiOptions.as<ReadableSavedQuery>()(
    '/organizations/$organizationIdOrSlug/explore/saved/$id/',
    {
      path: defined(id) ? {organizationIdOrSlug: organization.slug, id} : skipToken,
      staleTime: 0,
    }
  );
}

export function useGetSavedQuery(id?: string) {
  const organization = useOrganization();
  const {data, isLoading, isFetched} = useQuery(savedQueryApiOptions({organization, id}));
  const savedQuery = useMemo(() => {
    if (!defined(data)) {
      return undefined;
    }
    return Array.isArray(data.query) && data.query.length > 0
      ? new SavedQuery(data)
      : undefined;
  }, [data]);
  return {data: savedQuery, isLoading, isFetched};
}

export function useInvalidateSavedQuery(id?: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!defined(id)) {
      return;
    }
    queryClient.invalidateQueries({
      queryKey: savedQueryApiOptions({organization, id}).queryKey,
    });
  }, [queryClient, organization, id]);
}

const DATASET_LABEL_MAP: Record<ReadableSavedQuery['dataset'], string> = {
  logs: 'Logs',
  spans: 'Traces',
  segment_spans: 'Traces',
  metrics: 'Metrics',
  replays: 'Replays',
};

const DATASET_TO_TRACE_ITEM_DATASET_MAP: Record<
  ReadableSavedQuery['dataset'],
  TraceItemDataset
> = {
  logs: TraceItemDataset.LOGS,
  spans: TraceItemDataset.SPANS,
  segment_spans: TraceItemDataset.SPANS,
  metrics: TraceItemDataset.TRACEMETRICS,
  replays: TraceItemDataset.REPLAYS,
};

export function getSavedQueryDatasetLabel(dataset: ReadableSavedQuery['dataset']) {
  return DATASET_LABEL_MAP[dataset];
}
