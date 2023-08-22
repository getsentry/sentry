import {useMemo} from 'react';

import EventView from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ReplayListLocationQuery} from 'sentry/views/replays/types';

import {FetchEventsResponse, FetchOptions, FetchTransactionResponse} from './types';

export function useFetchErrors(options: FetchOptions) {
  return useFetchEvents<FetchEventsResponse>({...options, type: 'error'});
}

export function useFetchTransactions(options: FetchOptions) {
  return useFetchEvents<FetchTransactionResponse>({...options, type: 'transaction'});
}

export function useFetchEvents<T extends FetchEventsResponse>({
  userId,
  type,
  limit = 5,
}: {
  type: 'error' | 'transaction';
  userId: string;
  limit?: number;
}) {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('user.id', userId);
    conditions.addFilterValue('event.type', type);

    // field: title
    // field: event.type
    // field: project.id
    // field: timestamp
    // per_page: 50
    // project: 11276
    // query: user.email%3Abilly%40sentry.io
    // referrer: api.discover.query-table
    // sort: -timestamp
    // statsPeriod: 7d

    const fields = [
      'message',
      'timestamp',
      'event.type',
      'project.id',
      'project',
      'os.name',
      'os.version',
      'browser.name',
      'browser.version',
    ];

    if (type === 'transaction') {
      fields.push('transaction.duration');
      fields.push('span_ops_breakdown.relative');
      fields.push('spans.browser');
      fields.push('spans.db');
      fields.push('spans.http');
      fields.push('spans.resource');
      fields.push('spans.ui');
      fields.push('transaction.duration');
    }

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields,
        projects: [],
        query: conditions.formatString(),
        orderby: '-timestamp',
      },
      location
    );
  }, [location, userId, type]);

  const payload = eventView.getEventsAPIPayload(location);
  payload.per_page = limit;
  payload.sort = ['-timestamp', 'message'];

  const results = useApiQuery<T>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...payload,
          queryReferrer: 'issueReplays',
        },
      },
    ],
    {staleTime: 0, retry: false}
  );

  return {
    events: results.data?.data,
    isFetching: results.isLoading,
    fetchError: results.error,
    eventView,
  };
}
