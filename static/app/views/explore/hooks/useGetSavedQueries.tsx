import type {Actor} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
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
  start: string;
};

type Props = {
  sortBy: string;
  exclude?: 'owned' | 'shared';
  perPage?: number;
};

export function useGetSavedQueries({sortBy, exclude, perPage = 5}: Props) {
  const organization = useOrganization();
  const {data, isLoading} = useApiQuery<SavedQuery[]>(
    [
      `/organizations/${organization.slug}/explore/saved/`,
      {query: {sortBy, exclude, per_page: perPage}},
    ],
    {
      staleTime: 0,
    }
  );

  return {data, isLoading};
}
