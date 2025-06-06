import {useCallback} from 'react';

import type {Actor} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

export type RawGroupBy = {
  groupBy: string;
};

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

type Query = {
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
export type SavedQuery = {
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
  createdBy?: Actor;
  end?: string;
  environment?: string[];
  isPrebuilt?: boolean;
  range?: string;
  start?: string;
};

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

  const {data, isLoading, getResponseHeader, ...rest} = useApiQuery<SavedQuery[]>(
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

  return {data, isLoading, pageLinks, ...rest};
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
  const {data, isLoading, ...rest} = useApiQuery<SavedQuery>(
    [`/organizations/${organization.slug}/explore/saved/${id}/`],
    {
      staleTime: 0,
      enabled: defined(id),
    }
  );
  return {data, isLoading, ...rest};
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
