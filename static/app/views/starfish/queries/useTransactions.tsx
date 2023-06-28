import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type Transaction = {
  id: string;
  'project.name': string;
  timestamp: string;
  'transaction.duration': number;
};

export function useTransactions(eventIDs: string[], referrer = 'use-transactions') {
  const location = useLocation();
  const {slug} = useOrganization();

  const eventView = EventView.fromNewQueryWithLocation(
    {
      fields: ['id', 'timestamp', 'project.name', 'transaction.duration'],
      name: 'Transactions',
      projects: [1],
      version: 2,
      query: `id:[${eventIDs.join(',')}]`,
    },
    location
  );

  const enabled = Boolean(eventIDs.length);

  const response = useDiscoverQuery({
    eventView,
    location,
    orgSlug: slug,
    referrer,
    options: {
      enabled,
    },
  });
  const data = (response.data?.data ?? []) as unknown as Transaction[];

  if (!enabled) {
    return {
      isFetching: false,
      isLoading: false,
      data: [],
    };
  }

  return {
    ...response,
    data,
  };
}
