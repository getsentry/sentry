import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';

const QUERY = 'span.module:http span.op:http.client';

export const ALERTS: Record<string, AlertConfig> = {
  spm: {
    aggregate: 'spm()',
    query: QUERY,
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
    query: QUERY,
  },
  threeHundreds: {
    aggregate: 'http_response_rate(3)',
    query: QUERY,
    name: 'Create 3XX Response Rate Alert',
  },
  fourHundreds: {
    aggregate: 'http_response_rate(4)',
    query: QUERY,
    name: 'Create 4XX Response Rate Alert',
  },
  fiveHundreds: {
    aggregate: 'http_response_rate(5)',
    query: QUERY,
    name: 'Create 5XX Response Rate Alert',
  },
};
