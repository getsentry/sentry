export type ColumnValueType = 'numeric' | 'string' | 'unknown';

// todo(leedongwei): Find the correct types
export const AGGREGATIONS = {
  latest_event: {
    type: 'string',
    isSortable: true,
  },
  last_seen: {
    type: 'string',
    isSortable: true,
  },
  count: {
    type: 'numeric',
    isSortable: true,
  },
  count_unique: {
    type: 'numeric',
    isSortable: true,
  },
  rpm: {
    type: 'numeric',
    isSortable: true,
  },
  pXX: {
    type: 'numeric',
    isSortable: true,
  },
  avg: {
    type: 'numeric',
    isSortable: true,
  },
  min: {
    type: 'numeric',
    isSortable: true,
  },
  max: {
    type: 'numeric',
    isSortable: true,
  },
  sum: {
    type: 'numeric',
    isSortable: true,
  },
  cidr: {
    type: 'unknown',
    isSortable: true,
  },
};
export type Aggregation = keyof typeof AGGREGATIONS | '';

// todo(leedongwei): Find the correct types
export const FIELDS = {
  id: 'string',
  message: 'string',
  title: 'string',
  location: 'string',
  culprit: 'string',
  issue: 'string',
  timestamp: 'string',
  type: 'string',
  release: 'string',
  environment: 'string',
  'sdk.name': 'string',
  'sdk.version': 'string',
  'device.name': 'numeric',
  'device.brand': 'numeric',
  'device.locale': 'numeric',
  'device.model_id': 'numeric',
  'device.arch': 'numeric',
  'device.battery_level': 'string',
  'device.orientation': 'string',
  'device.simulator': 'string',
  'device.online': 'string',
  'device.charging': 'string',
  'geo.country_code': 'numeric',
  'geo.region': 'numeric',
  'geo.city': 'numeric',
  'error.type': 'string',
  'error.value': 'string',
  'error.handled': 'string',
  'error.mechanism': 'string',
  'stack.abs_path': 'string',
  'stack.filename': 'string',
  'stack.package': 'string',
  'stack.module': 'string',
  'stack.function': 'string',
  'stack.in_app': 'string',
  'contexts.key': 'string',
  'contexts.value': 'string',
  'platform.name': 'string',
};
export type Field = keyof typeof FIELDS | '';
