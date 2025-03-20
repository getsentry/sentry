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
  id: number;
  interval: string;
  lastVisited: string;
  name: string;
  projects: number[];
  query: Array<{
    fields: string[];
    groupby: string[];
    mode: string;
    orderby: string;
    query: string;
    visualize: Array<{
      chartType: number;
      yAxes: string[];
    }>;
  }>;
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
  const api = useApi();
  const organization = useOrganization();
  const {data, isLoading} = useQuery<SavedQuery[]>({
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
