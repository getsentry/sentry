const TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATETIME: 'datetime',
};

export const PROMOTED_TAGS = [
  {name: 'tags[level]', type: TYPES.STRING},
  {name: 'tags[logger]', type: TYPES.STRING},
  {name: 'tags[server_name]', type: TYPES.STRING},
  {name: 'tags[transaction]', type: TYPES.STRING},
  {name: 'tags[environment]', type: TYPES.STRING},
  {name: 'tags[site]', type: TYPES.STRING},
  {name: 'tags[url]', type: TYPES.STRING},
  {name: 'tags[app_device]', type: TYPES.STRING},
  {name: 'tags[device]', type: TYPES.STRING},
  {name: 'tags[device_family]', type: TYPES.STRING},
  {name: 'tags[runtime]', type: TYPES.STRING},
  {name: 'tags[runtime_name]', type: TYPES.STRING},
  {name: 'tags[browser]', type: TYPES.STRING},
  {name: 'tags[browser_name]', type: TYPES.STRING},
  {name: 'tags[os]', type: TYPES.STRING},
  {name: 'tags[os_name]', type: TYPES.STRING},
  {name: 'tags[os_rooted]', type: TYPES.BOOLEAN},
  {name: 'tags[sentry:release]', type: TYPES.STRING},
];

// All tags are assumed to be strings, except the following
export const SPECIAL_TAGS = {
  'tags[os_rooted]': TYPES.BOOLEAN,
};

export const COLUMNS = [
  {name: 'event_id', type: TYPES.STRING},
  {name: 'project_id', type: TYPES.STRING},
  {name: 'project_name', type: TYPES.STRING}, // Not a snuba column
  {name: 'platform', type: TYPES.STRING},
  {name: 'message', type: TYPES.STRING},
  {name: 'primary_hash', type: TYPES.STRING},
  {name: 'timestamp', type: TYPES.DATETIME},
  {name: 'received', type: TYPES.DATETIME},

  {name: 'user.id', type: TYPES.STRING},
  {name: 'user.username', type: TYPES.STRING},
  {name: 'user.email', type: TYPES.STRING},
  {name: 'user.ip', type: TYPES.STRING},

  {name: 'sdk.name', type: TYPES.STRING},
  {name: 'sdk.version', type: TYPES.STRING},
  {name: 'tags_key', type: TYPES.STRING},
  {name: 'tags_value', type: TYPES.STRING},
  {name: 'contexts.key', type: TYPES.STRING},
  {name: 'contexts.value', type: TYPES.STRING},
  {name: 'http.method', type: TYPES.STRING},
  {name: 'http.url', type: TYPES.STRING},
  {name: 'os.build', type: TYPES.STRING},
  {name: 'os.kernel_version', type: TYPES.STRING},
  {name: 'device.name', type: TYPES.STRING},
  {name: 'device.brand', type: TYPES.STRING},
  {name: 'device.locale', type: TYPES.STRING},
  {name: 'device.uuid', type: TYPES.STRING},
  {name: 'device.model_id', type: TYPES.STRING},
  {name: 'device.arch', type: TYPES.STRING},
  {name: 'device.battery_level', type: TYPES.NUMBER},
  {name: 'device.orientation', type: TYPES.STRING},
  {name: 'device.simulator', type: TYPES.BOOLEAN},
  {name: 'device.online', type: TYPES.BOOLEAN},
  {name: 'device.charging', type: TYPES.BOOLEAN},
  {name: 'error.type', type: TYPES.STRING},
  {name: 'error.value', type: TYPES.STRING},
  {name: 'error.mechanism_type', type: TYPES.STRING},
  {name: 'error.mechanism_handled', type: TYPES.STRING},
  {name: 'stack.abs_path', type: TYPES.STRING},
  {name: 'stack.filename', type: TYPES.STRING},
  {name: 'stack.package', type: TYPES.STRING},
  {name: 'stack.module', type: TYPES.STRING},
  {name: 'stack.function', type: TYPES.STRING},
  {name: 'stack.in_app', type: TYPES.BOOLEAN},
  {name: 'stack.colno', type: TYPES.STRING},
  {name: 'stack.lineno', type: TYPES.STRING},
  {name: 'stack.stack_level', type: TYPES.STRING},
];

export const CONDITION_OPERATORS = [
  '>',
  '<',
  '>=',
  '<=',
  '=',
  '!=',
  // 'IN', commented out since condition input doesn't support arrays yet :(
  'IS NULL',
  'IS NOT NULL',
  'LIKE',
  'NOT LIKE',
];

export const ARRAY_FIELD_PREFIXES = ['error', 'stack'];

export const NUMBER_OF_SERIES_BY_DAY = 10;
