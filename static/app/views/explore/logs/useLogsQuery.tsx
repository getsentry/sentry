import {useEffect, useState} from 'react';

import type EventView from 'sentry/utils/discover/eventView';
import {
  useLogsFields,
  useLogsSearch,
  useLogsSortBys,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useOurlogs} from 'sentry/views/insights/common/queries/useDiscover';

export interface OurLogsTableResult {
  eventView: EventView;
  result: ReturnType<typeof useOurlogs>;
}

export function useExploreLogsTable(options: Parameters<typeof useOurlogs>[0]) {
  const search = useLogsSearch();
  const fields = useLogsFields();
  const sortBys = useLogsSortBys();

  const {data, isError, isPending} = useOurlogs(
    {
      ...options,
      sorts: sortBys,
      fields,
      search,
    },
    'api.logs-tab.view'
  );

  return {data, isError, isPending};
}

export interface OurLogsTableRowDetails {
  attributes: Record<string, string | number>;
  body: string;
  id: string;
  item_type: string;
  organization_id: number;
  timestamp: string;
}

export function useExploreLogsTableRow(_props: {
  log_id: string | number;
  enabled?: boolean;
}) {
  const [isPending, setIsPending] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setIsPending(false);
    }, 500);
  }, []);
  const mockData: OurLogsTableRowDetails = {
    id: 'a'.repeat(32),
    item_type: 'log',
    organization_id: 1,
    timestamp: new Date().toISOString(),
    body: 'Added item to shopping cart: Xbox One X 500 GB 2018 Payment failure detected',
    attributes: {
      'log.severity_text': 'error',
      'sentry.level_value': 40,
      'sentry.message': 'This is a fake log event',
      user_id: '12345',
      order_id: '67890',
      payment_method: 'Credit Card',
      'this.attribute.is.deeply.nested': 'true',
      amount: '199.99',
      retry_count: '2',
      error_code: 'PAYMENT_TIMEOUT',
      timestamp: '2025-02-27T21:01:53+00:00',
      correlation_id: '1234567890',
      'sentry.body.template':
        'Added item to shopping cart: Xbox One X 500 GB 2018 Payment failure detected | userId={params.0} | orderId={params.1} | paymentMethod="{params.2}" | amount={params.3} | retryCount={params.4} | errorCode="{params.5}" | timestamp="{timestamp}" | Request failed after 3 seconds, network timeout at /payments/process endpoint, initiated by user action. | correlationId={params.6}',
      'params.0': '12345',
      'params.1': '67890',
      'params.2': 'Credit Card',
      'params.3': '199.99',
      'params.4': '2',
      'params.5': 'PAYMENT_TIMEOUT',
      'params.6': '1234567890',
      payment_status: 'failed',
      payment_vendor: 'Stripe',
      'payment.amount': '199.99',
      'payment.retry_count': '2',
      'payment.error_code': 'PAYMENT_TIMEOUT',
      'payment.correlation_id': '1234567890',
      'payment.timestamp': '2025-02-27T21:01:53+00:00',
    },
  };

  return {
    data: mockData,
    isError: false,
    isPending,
  };
}
