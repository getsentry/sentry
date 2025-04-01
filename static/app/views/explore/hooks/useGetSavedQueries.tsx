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
  exclude?: 'owned' | 'shared';
  perPage?: number;
  sortBy?: 'lastVisited' | 'dateAdded' | 'dateUpdated' | 'mostPopular';
  starred?: boolean;
};

export function useGetSavedQueries({sortBy, exclude, starred, perPage = 5}: Props) {
  const organization = useOrganization();
  const {data, isLoading} = useApiQuery<SavedQuery[]>(
    [
      `/organizations/${organization.slug}/explore/saved/`,
      {query: {sortBy, exclude, per_page: perPage, starred: starred ? 1 : undefined}},
    ],
    {
      staleTime: 0,
    }
  );

  return {data, isLoading};
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
