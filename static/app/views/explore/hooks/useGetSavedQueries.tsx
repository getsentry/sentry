import type {Actor} from 'sentry/types/core';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

// Comes from ExploreSavedQueryModelSerializer
export type SavedQuery = {
  createdBy: Actor;
  dateAdded: string;
  dateUpdated: string;
  end: string;
  environment: string[];
  fields: string[];
  id: number;
  interval: string;
  lastVisited: string;
  mode: string;
  name: string;
  orderby: string;
  projects: number[];
  query: string;
  queryDataset: string;
  range: string;
  start: string;
  // Can probably have stricter type here
  visualize: Array<{
    chartType: number;
    yAxes: string[];
  }>;
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
