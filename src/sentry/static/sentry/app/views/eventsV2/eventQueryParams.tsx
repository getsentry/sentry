export type ColumnValueType =
  | '*' // Matches to everything
  | 'string'
  | 'number'
  | 'duration'
  | 'timestamp'
  | 'boolean'
  | 'never'; // Matches to nothing

// Refer to src/sentry/utils/snuba.py
export const AGGREGATIONS: {
  [key: string]: {
    type: '*' | ColumnValueType[];
    isSortable: boolean;
  };
} = {
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
  sum: {
    type: ['duration'],
    isSortable: true,
  },
  avg: {
    type: ['duration'],
    isSortable: true,
  },
  /*
  cidr: {
    type: 'string',
    isSortable: true,
  },
  */
};
export type Aggregation = keyof typeof AGGREGATIONS | '';

// TODO(leedongwei)
// Add line-breaks to these fields that'll show on TableModalEditColumn. It's
// hella dense at the moment.
/**
 * Refer to src/sentry/utils/snuba.py, search for SENTRY_SNUBA_MAP
 */
export const FIELDS: {[key: string]: ColumnValueType} = {
  id: 'string',

  title: 'string',
  project: 'string',
  environment: 'string',
  release: 'string',
  'issue.id': 'string',

  message: 'string',
  location: 'string',
  culprit: 'string',
  timestamp: 'timestamp',
  time: 'timestamp',
  transaction: 'string',

  'event.type': 'string',
  'platform.name': 'string',
  last_seen: 'never',
  latest_event: 'never',

  // user
  user: 'string',
  'user.id': 'string',
  'user.email': 'string',
  'user.username': 'string',
  'user.ip': 'string',
  sdk: 'string',
  'sdk.name': 'string',
  'sdk.version': 'string',
  http: 'string',
  'http.method': 'string',
  'http.url': 'string',
  os: 'string',
  'os.build': 'string',
  'os.kernel_version': 'string',
  device: 'string',
  'device.name': 'string',
  'device.brand': 'string',
  'device.locale': 'string',
  'device.uuid': 'string',
  'device.model_id': 'string',
  'device.arch': 'string',
  'device.battery_level': 'number',
  'device.orientation': 'string',
  'device.simulator': 'boolean',
  'device.online': 'boolean',
  'device.charging': 'boolean',
  geo: 'string',
  'geo.country_code': 'string',
  'geo.region': 'string',
  'geo.city': 'string',
  error: 'string',
  'error.type': 'string',
  'error.value': 'string',
  'error.mechanism': 'string',
  'error.handled': 'boolean',
  stack: 'string',
  'stack.abs_path': 'string',
  'stack.filename': 'string',
  'stack.package': 'string',
  'stack.module': 'string',
  'stack.function': 'string',
  'stack.in_app': 'boolean',
  'stack.colno': 'number',
  'stack.lineno': 'number',
  'stack.stack_level': 'string',
  tags: 'string',
  'tags.key': 'string',
  'tags.value': 'string',
  contexts: 'string',
  'contexts.key': 'string',
  'contexts.value': 'string',

  'transaction.duration': 'duration',
  'transaction.op': 'string',
  // duration aliases
  p75: 'number',
  p95: 'number',
};
export type Field = keyof typeof FIELDS | string | '';

// This list should be removed with the tranaction-events feature flag.
export const TRACING_FIELDS = [
  'avg',
  'sum',
  'transaction.duration',
  'transaction.op',
  'p95',
  'p75',
];

// list of fields that are duration-like
export const DURATION_FIELDS = ['transaction.duration', 'p95', 'p75'];
// acceptable list of aggregate functions, that, when applied to any of the duration-like
// fields in DURATION_FIELDS, the resulting expression is still duration-like
export const DURATION_AGGREGATION_WHITELIST = ['min', 'max', 'sum', 'avg'];
