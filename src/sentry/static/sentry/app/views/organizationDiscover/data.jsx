const TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATETIME: 'datetime',
};

export const PROMOTED_TAGS = [
  'level',
  'logger',
  'server.name',
  'transaction',
  'environment',
  'site',
  'url',
  'app.device',
  'device',
  'device.family',
  'runtime',
  'runtime.name',
  'browser',
  'browser.name',
  'os',
  'os.name',
  'os.rooted',
  'sentry:release',
];

// All tags are assumed to be strings, except the following
export const SPECIAL_TAGS = {
  os_rooted: TYPES.BOOLEAN,
};

export const COLUMNS = [
  {name: 'id', type: TYPES.STRING},
  {name: 'issue.id', type: TYPES.STRING},
  {name: 'project.id', type: TYPES.STRING},
  {name: 'project.name', type: TYPES.STRING},
  {name: 'platform', type: TYPES.STRING},
  {name: 'message', type: TYPES.STRING},
  {name: 'primary_hash', type: TYPES.STRING},
  {name: 'timestamp', type: TYPES.DATETIME},

  {name: 'user.id', type: TYPES.STRING},
  {name: 'user.username', type: TYPES.STRING},
  {name: 'user.email', type: TYPES.STRING},
  {name: 'user.ip', type: TYPES.STRING},

  {name: 'sdk.name', type: TYPES.STRING},
  {name: 'sdk.version', type: TYPES.STRING},
  // {name: 'tags_key', type: TYPES.STRING},
  // {name: 'tags_value', type: TYPES.STRING},
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
  {name: 'geo.country_code', type: TYPES.STRING},
  {name: 'geo.region', type: TYPES.STRING},
  {name: 'geo.city', type: TYPES.STRING},
  {name: 'error.type', type: TYPES.STRING},
  {name: 'error.value', type: TYPES.STRING},
  {name: 'error.mechanism', type: TYPES.STRING},
  {name: 'error.handled', type: TYPES.STRING},
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

export const NON_SNUBA_FIELDS = ['issue.id', 'project.name'];

export const NON_CONDITIONS_FIELDS = [...NON_SNUBA_FIELDS, 'project.id'];

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
