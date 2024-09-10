import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';

export const ALERTS: Record<string, AlertConfig> = {
  spm: {
    aggregate: 'spm()',
    query: 'span.module:http span.op:http.client',
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
    query: 'span.module:http span.op:http.client',
  },
  threeHundreds: {
    aggregate: 'http_response_rate(3)',
    query: 'span.module:http span.op:http.client',
    name: 'Create 3XX Response Rate Alert',
  },
  fourHundreds: {
    aggregate: 'http_response_rate(4)',
    query: 'span.module:http span.op:http.client',
    name: 'Create 4XX Response Rate Alert',
  },
  fiveHundreds: {
    aggregate: 'http_response_rate(5)',
    query: 'span.module:http span.op:http.client',
    name: 'Create 5XX Response Rate Alert',
  },
};
