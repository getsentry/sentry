import {useCallback, useMemo} from 'react';

import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

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
  groupby?: string[];
  visualize?: RawVisualize[];
};

class Query {
  fields: string[];
  mode: Mode;
  orderby: string;
  query: string;

  aggregateField: Array<RawGroupBy | RawVisualize>;
  groupby: string[];
  visualize: RawVisualize[];

  constructor(query: ReadableQuery) {
    this.fields = query.fields;
    this.mode = query.mode;
    this.orderby = query.orderby;
    this.query = query.query;

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
type ReadableSavedQuery = {
  dateAdded: string;
  dateUpdated: string;
  id: number;
  interval: string;
  lastVisited: string;
  name: string;
  position: number | null;
  projects: number[];
  query: [ReadableQuery, ...ReadableQuery[]];
  queryDataset: string;
  starred: boolean;
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
  query: [Query, ...Query[]];
  queryDataset: string;
  starred: boolean;
  createdBy?: User;
  end?: string;
  environment?: string[];
  isPrebuilt?: boolean;
  range?: string;
  start?: string;

  constructor(savedQuery: ReadableSavedQuery) {
    this.dateAdded = savedQuery.dateAdded;
    this.dateUpdated = savedQuery.dateUpdated;
    this.id = savedQuery.id;
    this.interval = savedQuery.interval;
    this.lastVisited = savedQuery.lastVisited;
    this.name = savedQuery.name;
    this.position = savedQuery.position;
    this.projects = savedQuery.projects;
    this.query = [
      new Query(savedQuery.query[0]),
      ...savedQuery.query.slice(1).map(q => new Query(q)),
    ];
    this.queryDataset = savedQuery.queryDataset;
    this.starred = savedQuery.starred;
    this.createdBy = savedQuery.createdBy;
    this.end = savedQuery.end;
    this.environment = savedQuery.environment;
    this.isPrebuilt = savedQuery.isPrebuilt;
    this.range = savedQuery.range;
    this.start = savedQuery.start;
  }
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

  const {data, isLoading, getResponseHeader, ...rest} = useApiQuery<ReadableSavedQuery[]>(
    [
      `/organizations/${organization.slug}/explore/saved/`,
      {
        query: {
          sortBy,
          exclude,
          per_page: perPage,
          starred: starred ? 1 : undefined,
          cursor,
          query,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const pageLinks = getResponseHeader?.('Link');

  const savedQueries = useMemo(() => data?.map(q => new SavedQuery(q)), [data]);
  return {data: savedQueries, isLoading, pageLinks, ...rest};
}

export function useInvalidateSavedQueries() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${organization.slug}/explore/saved/`],
    });
  }, [queryClient, organization.slug]);
}

export function useGetSavedQuery(id?: string) {
  const organization = useOrganization();
  const {data, isLoading, ...rest} = useApiQuery<ReadableSavedQuery>(
    [`/organizations/${organization.slug}/explore/saved/${id}/`],
    {
      staleTime: 0,
      enabled: defined(id),
    }
  );
  const savedQuery = useMemo(() => (defined(data) ? new SavedQuery(data) : data), [data]);
  return {data: savedQuery, isLoading, ...rest};
}

export function useInvalidateSavedQuery(id?: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${organization.slug}/explore/saved/${id}/`],
    });
  }, [queryClient, organization.slug, id]);
}
