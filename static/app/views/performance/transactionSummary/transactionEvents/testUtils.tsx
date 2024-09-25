import {
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';

export const MOCK_EVENTS_TABLE_DATA = [
  {
    id: 'deadbeef',
    'user.display': 'uhoh@example.com',
    'transaction.duration': 400,
    'project.id': 1,
    timestamp: '2020-05-21T15:31:18+00:00',
    trace: '1234',
    'span_ops_breakdown.relative': '',
    'spans.browser': 100,
    'spans.db': 30,
    'spans.http': 170,
    'spans.resource': 100,
    'spans.total.time': 400,
  },
  {
    id: 'moredeadbeef',
    'user.display': 'moreuhoh@example.com',
    'transaction.duration': 600,
    'project.id': 1,
    timestamp: '2020-05-22T15:31:18+00:00',
    trace: '4321',
    'span_ops_breakdown.relative': '',
    'spans.browser': 100,
    'spans.db': 300,
    'spans.http': 100,
    'spans.resource': 100,
    'spans.total.time': 600,
  },
];

export const EVENTS_TABLE_RESPONSE_FIELDS = [
  'id',
  'user.display',
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
  'transaction.duration',
  'trace',
  'timestamp',
  'spans.total.time',
  ...SPAN_OP_BREAKDOWN_FIELDS,
];
