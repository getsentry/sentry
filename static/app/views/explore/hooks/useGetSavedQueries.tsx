import {useCallback} from 'react';

import type {Actor} from 'sentry/types/core';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Query = {
  fields: string[];
  groupby: string[];
  mode: string;
  orderby: string;
  query: string;
  visualize: Array<{
    chartType: number;
    yAxes: string[];
  }>;
};

export type SortOption =
  | 'name'
  | 'dateAdded'
  | 'dateUpdated'
  | 'mostPopular'
  | 'recentlyViewed';

// Comes from ExploreSavedQueryModelSerializer
export type SavedQuery = {
  createdBy: Actor;
  dateAdded: string;
  dateUpdated: string;
  end: string;
  environment: string[];
  id: number;
  interval: string;
  lastVisited: string;
  name: string;
  projects: number[];
  query: [Query, ...Query[]];
  queryDataset: string;
  range: string;
  starred: boolean;
  start: string;
};

type Props = {
  cursor?: string;
  exclude?: 'owned' | 'shared';
  perPage?: number;
  query?: string;
  sortBy?: SortOption;
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

  const {data, isLoading, getResponseHeader} = useApiQuery<SavedQuery[]>(
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
          cursor_name: 'curs',
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const pageLinks = getResponseHeader?.('Link');

  return {data, isLoading, pageLinks};
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
