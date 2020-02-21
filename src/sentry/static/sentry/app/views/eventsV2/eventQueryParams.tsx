import {assert} from 'app/types/utils';

export type ColumnValueType =
  | '*' // Matches to everything
  | 'string'
  | 'integer'
  | 'number'
  | 'duration'
  | 'timestamp'
  | 'boolean'
  | 'never'; // Matches to nothing

// Refer to src/sentry/api/event_search.py
export const AGGREGATIONS = {
  count: {
    type: '*',
    isSortable: true,
  },
  count_unique: {
    type: '*',
    isSortable: true,
  },
  /*
  rpm: {
    type: 'numeric',
    isSortable: true,
  },
  pXX: {
    type: 'numeric',
    isSortable: true,
  },
  */
  min: {
    type: ['timestamp', 'duration'],
    isSortable: true,
  },
  max: {
    type: ['timestamp', 'duration'],
    isSortable: true,
  },
  avg: {
    type: ['duration'],
    isSortable: true,
  },
  sum: {
    type: ['duration'],
    isSortable: true,
  },
} as const;

assert(
  AGGREGATIONS as Readonly<
    {
      [key in keyof typeof AGGREGATIONS]: {
        type: '*' | Readonly<ColumnValueType[]>;
        isSortable: boolean;
      };
    }
  >
);

export type Aggregation = keyof typeof AGGREGATIONS | '';

/**
 * Refer to src/sentry/snuba/events.py, search for Columns
 */
export const FIELDS = {
  id: 'string',
  // issue.id and project.id are omitted on purpose.
  // Customers should use `issue` and `project` instead.
  timestamp: 'timestamp',
  time: 'timestamp',

  culprit: 'string',
  location: 'string',
  message: 'string',
  'platform.name': 'string',
  environment: 'string',
  release: 'string',
  dist: 'string',
  title: 'string',
  'event.type': 'string',
  // tags.key and tags.value are omitted on purpose as well.

  transaction: 'string',
  user: 'string',
  'user.id': 'string',
  'user.email': 'string',
  'user.username': 'string',
  'user.ip': 'string',
  'sdk.name': 'string',
  'sdk.version': 'string',
  'http.method': 'string',
  'http.url': 'string',
  'os.build': 'string',
  'os.kernel_version': 'string',
  'device.name': 'string',
  'device.brand': 'string',
  'device.locale': 'string',
  'device.uuid': 'string',
  'device.arch': 'string',
  'device.battery_level': 'number',
  'device.orientation': 'string',
  'device.simulator': 'boolean',
  'device.online': 'boolean',
  'device.charging': 'boolean',
  'geo.country_code': 'string',
  'geo.region': 'string',
  'geo.city': 'string',
  'error.type': 'string',
  'error.value': 'string',
  'error.mechanism': 'string',
  'error.handled': 'boolean',
  'stack.abs_path': 'string',
  'stack.filename': 'string',
  'stack.package': 'string',
  'stack.module': 'string',
  'stack.function': 'string',
  'stack.in_app': 'boolean',
  'stack.colno': 'number',
  'stack.lineno': 'number',
  'stack.stack_level': 'number',
  // contexts.key and contexts.value omitted on purpose.

  // Transaction event fields.
  'transaction.duration': 'duration',
  'transaction.op': 'string',
  'transaction.status': 'string',

  trace: 'string',
  'trace.span': 'string',
  'trace.parent_span': 'string',

  // Field alises defined in src/sentry/api/event_search.py
  project: 'string',
  issue: 'string',

  // duration aliases and fake functions.
  // Once we've expanded the functions support these
  // need to be revisited
  p75: 'duration',
  p95: 'duration',
  p99: 'duration',

  // TODO when these become real functions, we need to revisit how
  // their types are inferred in decodeColumnOrder()
  apdex: 'number',
  impact: 'number',
  error_rate: 'number',
} as const;
assert(FIELDS as Readonly<{[key in keyof typeof FIELDS]: ColumnValueType}>);

export type Field = keyof typeof FIELDS | string | '';

// This list should be removed with the tranaction-events feature flag.
export const TRACING_FIELDS = [
  'avg',
  'sum',
  'transaction.duration',
  'transaction.op',
  'transaction.status',
  'apdex',
  'impact',
  'p99',
  'p95',
  'p75',
  'error_rate',
];
