import type {Actor} from 'sentry/types/core';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

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
  const api = useApi();
  const organization = useOrganization();
  const {data, isLoading} = useQuery({
    queryKey: ['saved-queries', organization.slug, sortBy, exclude, perPage],
    queryFn: () =>
      api.requestPromise(`/organizations/${organization.slug}/explore/saved/`, {
        method: 'GET',
        data: {
          sortBy,
          exclude,
          per_page: perPage,
        },
      }),
  });

  return {data, isLoading};
}
