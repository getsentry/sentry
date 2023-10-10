import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/starfish/utils/retryHandlers';

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
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    },
  });
  const data = (response.data?.data ?? []) as unknown as Transaction[];

  if (!enabled) {
    return {
      isFetching: false,
      isLoading: false,
      error: null,
      data: [],
      isEnabled: enabled,
    };
  }

  return {
    ...response,
    isEnabled: enabled,
    data,
  };
}
