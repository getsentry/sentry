import {assert} from 'app/types/utils';

export type ColumnType =
  | '*' // Matches to everything TODO(mark) remove this in favour of explicit type lists.
  | 'string'
  | 'integer'
  | 'number'
  | 'duration'
  | 'timestamp'
  | 'boolean';

export type ColumnValueType = ColumnType | 'never'; // Matches to nothing

export type AggregateParameter =
  | {
      kind: 'column';
      columnTypes: Readonly<ColumnType[]>;
      defaultValue?: string;
      required: boolean;
    }
  | {
      kind: 'value';
      dataType: ColumnType;
      defaultValue?: string;
      required: boolean;
    };

// Refer to src/sentry/api/event_search.py
export const AGGREGATIONS = {
  count: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
  },
  count_unique: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['string', 'integer', 'number', 'duration', 'timestamp', 'boolean'],
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
  },
  min: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'number', 'duration', 'timestamp'],
        required: true,
      },
    ],
    outputType: null,
    isSortable: true,
  },
  max: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'number', 'duration', 'timestamp'],
        required: true,
      },
    ],
    outputType: null,
    isSortable: true,
  },
  avg: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'number', 'duration'],
        required: true,
      },
    ],
    outputType: null,
    isSortable: true,
  },
  sum: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['integer', 'number', 'duration'],
        required: true,
      },
    ],
    outputType: null,
    isSortable: true,
  },
  last_seen: {
    parameters: [],
    outputType: 'timestamp',
    isSortable: true,
  },

  // Tracing functions.
  p75: {
    parameters: [],
    outputType: 'duration',
    isSortable: true,
  },
  p95: {
    parameters: [],
    outputType: 'duration',
    type: [],
    isSortable: true,
  },
  p99: {
    parameters: [],
    outputType: 'duration',
    isSortable: true,
  },
  percentile: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['duration'],
        defaultValue: 'transaction.duration',
        required: true,
      },
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '0.5',
        required: true,
      },
    ],
    outputType: null,
    isSortable: true,
  },
  error_rate: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
  },
  apdex: {
    parameters: [
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
  },
  impact: {
    parameters: [
      {
        kind: 'value',
        dataType: 'number',
        defaultValue: '300',
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
  },
  rps: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
  },
  rpm: {
    parameters: [],
    outputType: 'number',
    isSortable: true,
  },
} as const;

assert(
  AGGREGATIONS as Readonly<
    {
      [key in keyof typeof AGGREGATIONS]: {
        parameters: Readonly<AggregateParameter[]>;
        // null means to inherit from the column.
        outputType: null | ColumnType;
        isSortable: boolean;
      };
    }
  >
);

export type Aggregation = keyof typeof AGGREGATIONS | '';
export type AggregationRefinement = string | undefined;

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
} as const;
assert(FIELDS as Readonly<{[key in keyof typeof FIELDS]: ColumnType}>);

export type Field = keyof typeof FIELDS | string | '';

// This list should be removed with the tranaction-events feature flag.
export const TRACING_FIELDS = [
  'avg',
  'sum',
  'transaction.duration',
  'transaction.op',
  'transaction.status',
  'p75',
  'p95',
  'p99',
  'percentile',
  'error_rate',
  'apdex',
  'impact',
  'rps',
  'rpm',
];

// In the early days of discover2 these functions were exposed
// as simple fields. Until we clean up all the saved queries we
// need this for backwards compatibility.
export const FIELD_ALIASES = [
  'apdex',
  'impact',
  'p99',
  'p95',
  'p75',
  'error_rate',
  'last_seen',
  'latest_event',
];
