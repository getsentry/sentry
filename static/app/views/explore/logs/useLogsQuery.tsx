import {useEffect, useState} from 'react';

import type EventView from 'sentry/utils/discover/eventView';
import useProjects from 'sentry/utils/useProjects';
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

export interface AttributeAnyValue {
  valFloat?: number;
  valInt?: string;
  valStr?: string;
}

type LogDetailsAttributes = Record<string, AttributeAnyValue>;

export interface OurLogsTableRowDetails {
  attributes: LogDetailsAttributes;
  itemId: string;
  timestamp: string;
  meta?: {
    requestId: string;
  };
}

export function useExploreLogsTableRow(_props: {
  log_id: string | number;
  project_id: string;
  enabled?: boolean;
}) {
  const {projects} = useProjects();
  const _project = projects.find(p => p.id === _props.project_id);

  const [isPending, setIsPending] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setIsPending(false);
    }, 500);
  }, []);
  const mockData: OurLogsTableRowDetails = {
    itemId: '01955D0A464B701AB80B98E6CD0CA27C',
    timestamp: '2025-03-03T17:25:09Z',
    attributes: {
      'sentry.trace_id': {
        valStr: 'c72d6f41754040efb9033be11f78e483',
      },
      'sentry.organization_id': {
        valInt: '1',
      },
      'sentry.project_id': {
        valInt: '2',
      },
      'sentry.item_type': {
        valInt: '3',
      },
      'sentry.body': {
        valStr: 'user sent message 193: what is a span',
      },
      'sentry.template': {
        valStr: 'user sent message $param0: $param1',
      },
      'sentry.span_id': {
        valStr: '',
      },
      param1: {
        valStr: 'what is a span',
      },
      'sentry.severity_text': {
        valStr: 'info',
      },
      param0: {
        valFloat: 193.0,
      },
      'sentry.severity_number': {
        valFloat: 10.0,
      },
      'sentry.severity_number.int': {
        valInt: '10',
      },
      user_id: {
        valStr: '12345',
      },
      order_id: {
        valStr: '67890',
      },
      payment_method: {
        valStr: 'Credit Card',
      },
      payment_status: {
        valStr: 'failed',
      },
      payment_vendor: {
        valStr: 'Stripe',
      },
      'payment.amount': {
        valStr: '199.99',
      },
      'payment.retry_count': {
        valInt: '2',
      },
      'payment.error_code': {
        valStr: 'PAYMENT_TIMEOUT',
      },
      'payment.correlation_id': {
        valStr: '1234567890',
      },
      'payment.timestamp': {
        valStr: '2025-02-27T21:01:53+00:00',
      },
      'user.id': {
        valStr: '12345',
      },
      'user.email': {
        valStr: 'test@example.com',
      },
      'this.attribute.is.deeply.nested': {
        valStr: 'true',
      },
      'another.deeply.nested.attribute': {
        valStr: 'true',
      },
    },
    meta: {
      requestId: 'bd69b517-6c01-4edf-a9d6-0b06a0e9d24f',
    },
  };

  return {
    data: mockData,
    isError: false,
    isPending,
  };
}
